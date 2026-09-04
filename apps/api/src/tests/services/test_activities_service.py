"""Tests for src/services/courses/activities/activities.py."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.db.courses.activities import Activity, ActivityCreate, ActivityRead, ActivityTypeEnum, ActivitySubTypeEnum, ActivityUpdate
from src.db.courses.chapter_activities import ChapterActivity
from src.db.users import AnonymousUser
from datetime import datetime
from src.db.organizations import OrganizationRead
from src.services.courses.activities.activities import (
    _apply_activity_lock,
    _trigger_course_embedding,
    create_activity,
    delete_activity,
    get_activities,
    get_activity,
    get_activityby_id,
    get_editor_bootstrap,
    update_activity,
    EditorBootstrapResponse,
)


class TestCreateActivity:
    @pytest.mark.asyncio
    async def test_raises_404_when_chapter_not_found(
        self, mock_request, db, org, admin_user
    ):
        activity_obj = ActivityCreate(
            name="Test",
            activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            chapter_id=9999,
            course_id=1,
            org_id=org.id,
            content={},
        )
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await create_activity(mock_request, activity_obj, admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_creates_activity_successfully(
        self, mock_request, db, org, course, chapter, admin_user
    ):
        activity_obj = ActivityCreate(
            name="New Activity",
            activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            chapter_id=chapter.id,
            course_id=course.id,
            org_id=org.id,
            content={"type": "doc", "content": []},
        )
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            result = await create_activity(mock_request, activity_obj, admin_user, db)

        assert isinstance(result, ActivityRead)
        assert result.name == "New Activity"


class TestGetEditorBootstrap:
    @pytest.mark.asyncio
    async def test_raises_404_when_activity_not_found(
        self, mock_request, db, org, course, chapter, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.check_ee_activity_paid_access",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "src.services.courses.activities.activities._apply_activity_lock",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await get_editor_bootstrap(mock_request, "nonexistent-uuid", admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_editor_bootstrap_response(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        fake_org_read = MagicMock(spec=OrganizationRead)

        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.check_ee_activity_paid_access",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "src.services.courses.activities.activities._apply_activity_lock",
            new_callable=AsyncMock,
        ), patch(
            "src.services.orgs.orgs._build_org_read_with_resolved",
            return_value=fake_org_read,
        ):
            result = await get_editor_bootstrap(
                mock_request, activity.activity_uuid, admin_user, db
            )

        assert isinstance(result, EditorBootstrapResponse)
        assert result.activity.name == activity.name
        assert result.course.org_uuid == org.org_uuid

    @pytest.mark.asyncio
    async def test_scrubs_content_when_no_paid_access(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        fake_org_read = MagicMock(spec=OrganizationRead)

        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.check_ee_activity_paid_access",
            new_callable=AsyncMock,
            return_value=False,
        ), patch(
            "src.services.courses.activities.activities._apply_activity_lock",
            new_callable=AsyncMock,
        ), patch(
            "src.services.orgs.orgs._build_org_read_with_resolved",
            return_value=fake_org_read,
        ):
            result = await get_editor_bootstrap(
                mock_request, activity.activity_uuid, admin_user, db
            )

        assert result.activity.content == {"paid_access": False}


class TestGetActivity:
    @pytest.mark.asyncio
    async def test_hidden_uuid_resolves_without_serializing_hidden_content(
        self, mock_request, db, org, course, chapter
    ):
        purchased = Activity(
            id=10, name="Purchased", activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            content={"secret": "purchased"}, published=True, org_id=org.id,
            course_id=course.id, activity_uuid="activity_purchased",
            extra_metadata={"access_variant": "purchased", "access_variant_group": "l7"},
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        )
        unpurchased = Activity(
            id=11, name="Unpurchased", activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            content={"safe": "unpurchased"}, published=True, org_id=org.id,
            course_id=course.id, activity_uuid="activity_unpurchased",
            extra_metadata={"access_variant": "unpurchased", "access_variant_group": "l7"},
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        )
        db.add_all([purchased, unpurchased])
        await db.flush()
        db.add_all([
            ChapterActivity(chapter_id=chapter.id, activity_id=purchased.id, course_id=course.id,
                            org_id=org.id, order=2, creation_date=str(datetime.now()), update_date=str(datetime.now())),
            ChapterActivity(chapter_id=chapter.id, activity_id=unpurchased.id, course_id=course.id,
                            org_id=org.id, order=3, creation_date=str(datetime.now()), update_date=str(datetime.now())),
        ])
        await db.commit()

        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.check_ee_activity_paid_access",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "src.services.courses.activities.activities._apply_activity_lock",
            new_callable=AsyncMock,
        ):
            result = await get_activity(
                mock_request, purchased.activity_uuid, AnonymousUser(), db
            )

        assert result.activity_uuid == unpurchased.activity_uuid
        assert result.resolved_activity_uuid == unpurchased.activity_uuid
        assert result.content == unpurchased.content

    @pytest.mark.asyncio
    async def test_raises_404_for_unknown_activity(
        self, mock_request, db, org, course, chapter, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.check_ee_activity_paid_access",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "src.services.courses.activities.activities._apply_activity_lock",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await get_activity(mock_request, "nonexistent-uuid", admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_activity_read(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.check_ee_activity_paid_access",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "src.services.courses.activities.activities._apply_activity_lock",
            new_callable=AsyncMock,
        ):
            result = await get_activity(
                mock_request, activity.activity_uuid, admin_user, db
            )

        assert isinstance(result, ActivityRead)
        assert result.name == activity.name


class TestUpdateActivity:
    @pytest.mark.asyncio
    async def test_raises_404_when_activity_not_found(
        self, mock_request, db, admin_user
    ):
        update_obj = ActivityUpdate(name="Updated")
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await update_activity(mock_request, update_obj, "nonexistent-uuid", admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_updates_activity_name(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        update_obj = ActivityUpdate(name="Renamed Activity")
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.create_activity_version",
            new_callable=AsyncMock,
        ):
            result = await update_activity(
                mock_request, update_obj, activity.activity_uuid, admin_user, db
            )
        assert isinstance(result, ActivityRead)
        assert result.name == "Renamed Activity"

    @pytest.mark.asyncio
    async def test_updates_activity_content_creates_version(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        new_content = {"type": "doc", "content": [{"type": "paragraph"}]}
        update_obj = ActivityUpdate(content=new_content)
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.activities.activities.create_activity_version",
            new_callable=AsyncMock,
        ) as mock_version, patch(
            "src.services.courses.activities.activities._trigger_course_embedding",
            new_callable=AsyncMock,
        ):
            result = await update_activity(
                mock_request, update_obj, activity.activity_uuid, admin_user, db
            )
        assert isinstance(result, ActivityRead)
        mock_version.assert_called_once()


class TestDeleteActivity:
    @pytest.mark.asyncio
    async def test_raises_404_when_activity_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await delete_activity(mock_request, "nonexistent-uuid", admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_deletes_activity(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.transfer.storage_utils.delete_storage_directory",
            return_value=None,
        ):
            result = await delete_activity(
                mock_request, activity.activity_uuid, admin_user, db
            )
        assert result == {"detail": "Activity deleted"}


class TestGetActivityById:
    @pytest.mark.asyncio
    async def test_raises_404_when_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await get_activityby_id(mock_request, 99999, admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_activity_by_id(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            result = await get_activityby_id(mock_request, activity.id, admin_user, db)
        assert isinstance(result, ActivityRead)
        assert result.id == activity.id


# ---------------------------------------------------------------------------
# _apply_activity_lock
# ---------------------------------------------------------------------------

_PATCH_IS_ORG_ADMIN = "src.services.courses.activities.activities.is_org_admin"
_PATCH_BATCH_ACCESSIBLE = "src.services.courses.activities.activities.batch_accessible_restricted_uuids"
_PATCH_IS_LOCKED = "src.services.courses.activities.activities.is_locked_for_user"


class TestApplyActivityLock:
    @pytest.mark.asyncio
    async def test_admin_bypasses_lock(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        """Admin path: returns immediately without locking (covers lines 272-275)."""
        activity_read = ActivityRead.model_validate(activity)
        with patch(_PATCH_IS_ORG_ADMIN, new_callable=AsyncMock, return_value=True):
            await _apply_activity_lock(activity_read, activity, course, admin_user, db)
        assert activity_read.is_locked is False

    @pytest.mark.asyncio
    async def test_uses_provided_parent_chapter(
        self, mock_request, db, org, course, chapter, activity, regular_user
    ):
        """parent_chapter provided: no extra query (covers line 281)."""
        activity_read = ActivityRead.model_validate(activity)
        with patch(_PATCH_IS_ORG_ADMIN, new_callable=AsyncMock, return_value=False), \
             patch(_PATCH_BATCH_ACCESSIBLE, new_callable=AsyncMock, return_value=set()), \
             patch(_PATCH_IS_LOCKED, new_callable=AsyncMock, return_value=False):
            await _apply_activity_lock(
                activity_read, activity, course, regular_user, db, parent_chapter=chapter
            )
        assert activity_read.is_locked is False

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_fetches_chapter_when_not_provided(
        self, mock_request, db, org, course, chapter, activity, regular_user
    ):
        """parent_chapter=None: queries DB for chapter (covers line 285)."""
        activity_read = ActivityRead.model_validate(activity)
        with patch(_PATCH_IS_ORG_ADMIN, new_callable=AsyncMock, return_value=False), \
             patch(_PATCH_BATCH_ACCESSIBLE, new_callable=AsyncMock, return_value=set()), \
             patch(_PATCH_IS_LOCKED, new_callable=AsyncMock, return_value=False):
            await _apply_activity_lock(
                activity_read, activity, course, regular_user, db, parent_chapter=None
            )
        assert activity_read.is_locked is False

    @pytest.mark.asyncio
    async def test_locks_activity_when_restricted(
        self, mock_request, db, org, course, chapter, activity, regular_user
    ):
        """Covers lines 295, 305, 315, 326-329 (restricted lock path)."""
        activity_read = ActivityRead.model_validate(activity)
        with patch(_PATCH_IS_ORG_ADMIN, new_callable=AsyncMock, return_value=False), \
             patch(_PATCH_BATCH_ACCESSIBLE, new_callable=AsyncMock, return_value=set()), \
             patch(_PATCH_IS_LOCKED, new_callable=AsyncMock, return_value=True):
            await _apply_activity_lock(
                activity_read, activity, course, regular_user, db
            )
        assert activity_read.is_locked is True


# ---------------------------------------------------------------------------
# _trigger_course_embedding
# ---------------------------------------------------------------------------


class TestTriggerCourseEmbedding:
    @pytest.mark.asyncio
    async def test_runs_embedding_when_course_found(self, db, course):
        """Covers lines 438-439 (lazy imports inside _trigger_course_embedding)."""
        async def fake_get_db():
            yield db

        with patch(
            "src.core.events.database.get_db_session",
            return_value=fake_get_db(),
        ), patch(
            "src.services.ai.rag.embedding_service.embed_course_content",
            new_callable=AsyncMock,
        ) as mock_embed:
            await _trigger_course_embedding(course.id, course.org_id)

        mock_embed.assert_called_once_with(course.id, course.org_id, db)


# ---------------------------------------------------------------------------
# get_activities
# ---------------------------------------------------------------------------


class TestGetActivities:
    @pytest.mark.asyncio
    async def test_raises_404_when_no_published_activities(
        self, mock_request, db, org, course, chapter, admin_user
    ):
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc:
                await get_activities(mock_request, chapter.id, admin_user, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_published_activities(
        self, mock_request, db, org, course, chapter, activity, admin_user
    ):
        """Covers line 525 (the select statement in get_activities)."""
        with patch(
            "src.services.courses.activities.activities.check_resource_access",
            new_callable=AsyncMock,
        ):
            result = await get_activities(mock_request, chapter.id, admin_user, db)
        assert isinstance(result, list)
        assert len(result) >= 1
