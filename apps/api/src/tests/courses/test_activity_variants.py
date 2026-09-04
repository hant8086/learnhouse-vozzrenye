"""Focused contract tests for paired lesson projection."""

from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

import pytest

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.services.courses.activity_variants import (
    choose_activity_variant,
    logical_activity_key,
    parse_activity_variant,
    select_visible_activities,
    valid_variant_pairs,
)
from src.db.users import AnonymousUser, PublicUser


def activity(number: int, *, course_id: int = 1, metadata: dict | None = None) -> Activity:
    return Activity(
        id=number,
        name=f"activity-{number}",
        activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
        content={"body": number},
        published=True,
        org_id=1,
        course_id=course_id,
        activity_uuid=f"activity_{number}",
        extra_metadata=metadata,
    )


def test_incomplete_metadata_is_an_independent_activity():
    row = activity(1, metadata={"access_variant": "purchased"})
    assert parse_activity_variant(row) is None
    assert logical_activity_key(row) == ("activity", 1)


def test_only_exact_purchased_unpurchased_pair_is_variant_group():
    purchased = activity(1, metadata={"access_variant": "purchased", "access_variant_group": "g"})
    unpurchased = activity(2, metadata={"access_variant": "unpurchased", "access_variant_group": "g"})
    duplicate = activity(3, metadata={"access_variant": "purchased", "access_variant_group": "g"})
    assert valid_variant_pairs([purchased, unpurchased]) == {"g": {"purchased": purchased, "unpurchased": unpurchased}}
    assert valid_variant_pairs([purchased, unpurchased, duplicate]) == {}


def test_same_group_in_different_chapters_fails_safe():
    purchased = activity(1, metadata={"access_variant": "purchased", "access_variant_group": "g"})
    unpurchased = activity(2, metadata={"access_variant": "unpurchased", "access_variant_group": "g"})
    scopes = {1: (10,), 2: (11,)}

    assert valid_variant_pairs([purchased, unpurchased], scopes) == {}
    assert logical_activity_key(purchased, [purchased, unpurchased], scopes) == ("activity", 1)


@pytest.mark.asyncio
async def test_anonymous_selects_unpurchased_and_member_selects_purchased():
    purchased = activity(1, metadata={"access_variant": "purchased", "access_variant_group": "g"})
    unpurchased = activity(2, metadata={"access_variant": "unpurchased", "access_variant_group": "g"})
    db = AsyncMock()
    db.execute.return_value = SimpleNamespace(all=lambda: [(1, 10), (2, 10)])

    anonymous = await select_visible_activities([purchased, unpurchased], AnonymousUser(), db)
    assert anonymous == [unpurchased]

    with patch(
        "src.services.courses.activity_variants.batch_accessible_restricted_uuids",
        new=AsyncMock(return_value={purchased.activity_uuid}),
    ):
        member = PublicUser(id=7, username="member", first_name="", last_name="", email="m@example.com", user_uuid="u")
        entitled = await select_visible_activities([purchased, unpurchased], member, db)
    assert entitled == [purchased]


@pytest.mark.asyncio
async def test_direct_hidden_read_resolves_to_visible_sibling():
    purchased = activity(1, metadata={"access_variant": "purchased", "access_variant_group": "g"})
    unpurchased = activity(2, metadata={"access_variant": "unpurchased", "access_variant_group": "g"})
    db = AsyncMock()
    db.execute.return_value = SimpleNamespace(all=lambda: [(1, 10), (2, 10)])

    selected = await choose_activity_variant(purchased, [purchased, unpurchased], AnonymousUser(), db)

    assert selected is unpurchased
    assert selected.content == {"body": 2}
