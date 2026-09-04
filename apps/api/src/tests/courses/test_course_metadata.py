"""Tests for the headless extra_metadata JSONB field on Course."""

from unittest.mock import AsyncMock, patch
from datetime import datetime

import pytest
from sqlmodel import select

from src.db.courses.courses import (
    Course,
    CourseCreate,
    CourseRead,
    CourseUpdate,
)
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroups import UserGroup
from src.db.users import AnonymousUser
from src.services.courses.courses import (
    create_course,
    get_courses_orgslug,
    update_course,
)


def _bypass_create_dependencies():
    """Patches required to run create_course in the test environment."""
    return (
        patch(
            "src.services.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ),
        patch("src.services.courses.courses.check_limits_with_usage"),
        patch("src.services.courses.courses.increase_feature_usage"),
        patch(
            "src.services.courses.courses.dispatch_webhooks",
            new_callable=AsyncMock,
        ),
    )


@pytest.mark.asyncio
async def test_create_course_with_extra_metadata(
    db, org, admin_user, mock_request
):
    """create_course persists extra_metadata and returns it on the read model."""
    metadata = {"sku": "ABC", "vendor": {"name": "x"}}
    rbac, limits, usage, webhooks = _bypass_create_dependencies()
    with rbac, limits, usage, webhooks:
        created = await create_course(
            mock_request,
            org.id,
            CourseCreate(
                org_id=org.id,
                name="Metadata Course",
                description="desc",
                public=False,
                published=False,
                open_to_contributors=False,
                extra_metadata=metadata,
            ),
            admin_user,
            db,
        )

    assert isinstance(created, CourseRead)
    assert created.extra_metadata == metadata

    row = (await db.execute(
        select(Course).where(Course.course_uuid == created.course_uuid)
    )).scalars().first()
    assert row is not None
    assert row.extra_metadata == metadata


@pytest.mark.asyncio
async def test_update_course_sets_extra_metadata(
    db, org, course, admin_user, mock_request, bypass_webhooks
):
    """update_course writes extra_metadata to the row."""
    with patch(
        "src.services.courses.courses.check_resource_access",
        new_callable=AsyncMock,
    ):
        updated = await update_course(
            mock_request,
            CourseUpdate(extra_metadata={"k": "v"}),
            course.course_uuid,
            admin_user,
            db,
        )

    assert updated.extra_metadata == {"k": "v"}

    await db.refresh(course)
    assert course.extra_metadata == {"k": "v"}


@pytest.mark.asyncio
async def test_update_course_does_not_clobber_extra_metadata_when_omitted(
    db, org, course, admin_user, mock_request, bypass_webhooks
):
    """A CourseUpdate that omits extra_metadata must leave the prior value intact."""
    course.extra_metadata = {"preserved": True}
    db.add(course)
    await db.commit()
    await db.refresh(course)

    with patch(
        "src.services.courses.courses.check_resource_access",
        new_callable=AsyncMock,
    ):
        updated = await update_course(
            mock_request,
            CourseUpdate(name="Renamed Course"),
            course.course_uuid,
            admin_user,
            db,
        )

    assert updated.name == "Renamed Course"
    assert updated.extra_metadata == {"preserved": True}

    await db.refresh(course)
    assert course.extra_metadata == {"preserved": True}


@pytest.mark.asyncio
async def test_get_courses_orgslug_returns_extra_metadata(
    db, org, admin_user, mock_request
):
    """Listing courses by org slug includes extra_metadata on each CourseRead."""
    metadata = {"channel": "web", "tags": ["a", "b"]}
    rbac, limits, usage, webhooks = _bypass_create_dependencies()
    with rbac, limits, usage, webhooks:
        created = await create_course(
            mock_request,
            org.id,
            CourseCreate(
                org_id=org.id,
                name="Listed Course",
                description="d",
                public=True,
                published=True,
                open_to_contributors=False,
                extra_metadata=metadata,
            ),
            admin_user,
            db,
        )

    results = await get_courses_orgslug(
        mock_request, admin_user, org.slug, db, page=1, limit=10
    )

    match = next(
        (c for c in results if c.course_uuid == created.course_uuid), None
    )
    assert match is not None
    assert match.extra_metadata == metadata


@pytest.mark.asyncio
async def test_anonymous_catalog_includes_published_paid_course_and_badges(
    db, org, course, mock_request
):
    paid = Course(
        id=22,
        name="Paid Preview",
        description="preview",
        public=False,
        published=True,
        open_to_contributors=False,
        org_id=org.id,
        course_uuid="course_paid_preview",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(paid)
    await db.flush()
    db.add(UserGroup(
        id=999,
        name="Paid members",
        description="paid",
        org_id=org.id,
        usergroup_uuid="usergroup_paid",
    ))
    await db.flush()
    db.add(UserGroupResource(
        usergroup_id=999,
        resource_uuid=paid.course_uuid,
        org_id=org.id,
    ))
    await db.commit()

    with patch("src.services.courses.cache.get_cached_courses_list", return_value=None), patch(
        "src.services.courses.cache.set_cached_courses_list"
    ):
        results = await get_courses_orgslug(
            mock_request, AnonymousUser(), org.slug, db, page=1, limit=10
        )

    preview = next(item for item in results if item.course_uuid == paid.course_uuid)
    assert preview.is_paid is True
    assert preview.has_access is False
