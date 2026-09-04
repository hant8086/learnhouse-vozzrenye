from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlmodel import select

from src.db.courses.courses import CourseUpdate
from src.db.organization_config import CourseCatalogConfig, OrganizationConfig
from src.services.courses.courses import _merge_course_extra_metadata
from src.services.courses.courses import update_course
from src.services.orgs.orgs import update_org_course_catalog_config


@pytest.mark.asyncio
async def test_catalog_config_is_validated_and_preserves_unrelated_config(
    db, org, admin_user, mock_request
):
    row = OrganizationConfig(
        org_id=org.id,
        config={"config_version": "2.0", "plan": "pro", "customization": {"general": {"color": "red"}}},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(row)
    await db.commit()

    result = await update_org_course_catalog_config(
        mock_request,
        CourseCatalogConfig(sections=[
            {"key": "z-section", "title": "Z", "order": 20},
            {"key": "a-section", "title": "A", "order": 10},
        ]),
        org.id,
        admin_user,
        db,
    )
    stored = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalar_one()
    assert [item["key"] for item in result["course_catalog"]["sections"]] == ["a-section", "z-section"]
    assert stored.config["plan"] == "pro"
    assert stored.config["customization"]["general"]["color"] == "red"

    with pytest.raises(ValidationError):
        CourseCatalogConfig(sections=[
            {"key": "same", "title": "One"},
            {"key": "same", "title": "Two"},
        ])


@pytest.mark.asyncio
async def test_catalog_config_requires_org_admin(db, org, regular_user, mock_request):
    row = OrganizationConfig(org_id=org.id, config={"config_version": "2.0"})
    db.add(row)
    await db.commit()

    with pytest.raises(HTTPException) as error:
        await update_org_course_catalog_config(
            mock_request,
            CourseCatalogConfig(sections=[]),
            org.id,
            regular_user,
            db,
        )
    assert getattr(error.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_catalog_config_uses_v1_fallback_path(db, org, admin_user, mock_request):
    row = OrganizationConfig(
        org_id=org.id,
        config={"config_version": "1.4", "general": {"color": "blue"}, "features": {}},
    )
    db.add(row)
    await db.commit()

    await update_org_course_catalog_config(
        mock_request,
        CourseCatalogConfig(sections=[{"key": "legacy", "title": "Legacy", "order": 1}]),
        org.id,
        admin_user,
        db,
    )
    stored = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalar_one()
    assert stored.config["course_catalog"]["sections"][0]["key"] == "legacy"
    assert stored.config["general"]["color"] == "blue"


def test_course_metadata_merge_and_clear_preserves_import_metadata():
    existing = {"source_key": "imported", "catalog_section_key": "old"}
    merged = _merge_course_extra_metadata(existing, {"catalog_section_key": "New Section", "other": 1})
    assert merged == {"source_key": "imported", "catalog_section_key": "new section", "other": 1}
    assert _merge_course_extra_metadata(merged, {"catalog_section_key": None}) == {
        "source_key": "imported", "other": 1
    }


def test_course_update_metadata_is_a_dict():
    update = CourseUpdate(extra_metadata={"catalog_section_key": "technology"})
    assert update.extra_metadata == {"catalog_section_key": "technology"}


@pytest.mark.asyncio
async def test_course_update_assigns_and_clears_section_without_metadata_loss(
    db, org, course, admin_user, mock_request
):
    course.extra_metadata = {"source_key": "imported", "owner": "author"}
    db.add(course)
    await db.commit()

    with patch("src.services.courses.courses.check_resource_access", new_callable=AsyncMock):
        assigned = await update_course(
            mock_request,
            CourseUpdate(extra_metadata={"catalog_section_key": "technology-enlightenment"}),
            course.course_uuid,
            admin_user,
            db,
        )
        cleared = await update_course(
            mock_request,
            CourseUpdate(extra_metadata={"catalog_section_key": None}),
            course.course_uuid,
            admin_user,
            db,
        )
        course.extra_metadata = {"catalog_section_key": "only-section"}
        db.add(course)
        await db.commit()
        cleared_last_key = await update_course(
            mock_request,
            CourseUpdate(extra_metadata={"catalog_section_key": None}),
            course.course_uuid,
            admin_user,
            db,
        )

    assert assigned.extra_metadata == {
        "source_key": "imported",
        "owner": "author",
        "catalog_section_key": "technology-enlightenment",
    }
    assert cleared.extra_metadata == {"source_key": "imported", "owner": "author"}
    assert cleared_last_key.extra_metadata is None
