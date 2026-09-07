"""Regression coverage for the public course-outline preview boundary."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.db.courses.activities import ActivityRead
from src.db.courses.chapters import ChapterRead
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import AnonymousUser
from src.security.rbac import AccessDecision
from src.services.courses.courses import get_course_meta


async def _add_course_gate(db, org, course, usergroup_id=991):
    db.add(UserGroup(
        id=usergroup_id,
        name="Paid learners",
        description="Course entitlement",
        org_id=org.id,
        usergroup_uuid=f"usergroup_{usergroup_id}",
    ))
    db.add(UserGroupResource(
        usergroup_id=usergroup_id,
        resource_uuid=course.course_uuid,
        org_id=org.id,
    ))
    await db.commit()


async def _grant_course_gate(db, org, user, usergroup_id=991):
    db.add(UserGroupUser(
        usergroup_id=usergroup_id,
        user_id=user.id,
        org_id=org.id,
    ))
    await db.commit()


def _chapter_preview(chapter, activity):
    return ChapterRead(
        **chapter.model_dump(),
        activities=[ActivityRead(**activity.model_dump())],
    )


@pytest.mark.asyncio
async def test_published_paid_meta_is_visible_to_anonymous_but_fully_locked(
    db, org, course, chapter, activity, mock_request
):
    # This is a gated/non-public course: the preview must still load its safe
    # outline through the real chapter service, while the public projection is
    # scrubbed at slim=False.
    course.public = False
    db.add(course)
    await db.commit()
    await _add_course_gate(db, org, course)

    with patch("src.services.courses.cache.get_cached_course_meta", return_value=None), patch(
        "src.services.courses.cache.set_cached_course_meta"
    ):
        result = await get_course_meta(
            mock_request, course.course_uuid, False, AnonymousUser(), db, slim=False
        )

    assert result.is_paid is True
    assert result.has_access is False
    assert result.chapters[0].is_locked is True
    assert result.chapters[0].activities[0].is_locked is True
    assert result.chapters[0].activities[0].content == {}
    assert result.chapters[0].activities[0].details is None


@pytest.mark.asyncio
async def test_published_paid_meta_is_scrubbed_for_authenticated_non_entitlement(
    db, org, course, chapter, activity, regular_user, mock_request
):
    await _add_course_gate(db, org, course)
    denied = AccessDecision(allowed=False, reason="not entitled")

    with patch(
        "src.services.courses.courses.check_resource_access",
        new_callable=AsyncMock,
        return_value=denied,
    ), patch(
        "src.services.courses.chapters.get_course_chapters",
        new_callable=AsyncMock,
        return_value=[_chapter_preview(chapter, activity)],
    ) as get_chapters:
        result = await get_course_meta(
            mock_request, course.course_uuid, False, regular_user, db, slim=False
        )

    assert result.has_access is False
    assert result.chapters[0].is_locked is True
    assert result.chapters[0].activities[0].is_locked is True
    assert result.chapters[0].activities[0].content == {}
    assert result.chapters[0].activities[0].details is None
    get_chapters.assert_awaited_once()
    assert get_chapters.await_args.kwargs["allow_published_preview"] is True


@pytest.mark.asyncio
async def test_entitled_meta_keeps_content_unlocked(
    db, org, course, chapter, activity, regular_user, mock_request
):
    await _add_course_gate(db, org, course)
    await _grant_course_gate(db, org, regular_user)
    allowed = AccessDecision(allowed=True, reason="usergroup entitlement")

    with patch(
        "src.services.courses.courses.check_resource_access",
        new_callable=AsyncMock,
        return_value=allowed,
    ), patch(
        "src.services.courses.chapters.get_course_chapters",
        new_callable=AsyncMock,
        return_value=[_chapter_preview(chapter, activity)],
    ) as get_chapters:
        result = await get_course_meta(
            mock_request, course.course_uuid, False, regular_user, db, slim=False
        )

    assert result.is_paid is True
    assert result.has_access is True
    assert result.chapters[0].activities[0].content == activity.content
    assert result.chapters[0].activities[0].is_locked is False
    get_chapters.assert_awaited_once()
    assert get_chapters.await_args.kwargs["allow_published_preview"] is True


@pytest.mark.asyncio
async def test_unpublished_meta_still_uses_the_normal_access_gate(
    db, org, course, regular_user, mock_request
):
    course.published = False
    db.add(course)
    await db.commit()
    denied = HTTPException(status_code=403, detail="not allowed")

    with patch(
        "src.services.courses.courses.check_resource_access",
        new_callable=AsyncMock,
        side_effect=denied,
    ) as check_access:
        with pytest.raises(HTTPException) as error:
            await get_course_meta(
                mock_request, course.course_uuid, False, regular_user, db
            )

    assert error.value.status_code == 403
    check_access.assert_awaited_once()
