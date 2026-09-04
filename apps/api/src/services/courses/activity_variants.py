"""Access variants for paired activities.

Variants deliberately live in ``Activity.extra_metadata`` so the normal
authoring/versioning/content paths remain unchanged.  This module is the only
place that interprets the two reserved metadata keys.
"""

from dataclasses import dataclass
from typing import Iterable, TypeVar

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.db.courses.chapter_activities import ChapterActivity
from src.db.trail_steps import TrailStep

from src.db.courses.activities import Activity
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.courses.locks import batch_accessible_restricted_uuids


@dataclass(frozen=True)
class ActivityVariant:
    group: str
    variant: str


def parse_activity_variant(activity: Activity) -> ActivityVariant | None:
    """Return reserved metadata only when it is complete and well-typed."""
    metadata = activity.extra_metadata
    if not isinstance(metadata, dict):
        return None
    variant = metadata.get("access_variant")
    group = metadata.get("access_variant_group")
    if variant not in {"purchased", "unpurchased"}:
        return None
    if not isinstance(group, str) or not group.strip():
        return None
    return ActivityVariant(group=group.strip(), variant=variant)


def logical_activity_key(
    activity: Activity,
    activities: Iterable[Activity] | None = None,
) -> tuple[str, str | int]:
    """Stable key used by completion/count projections.

    Invalid or incomplete metadata is intentionally independent, which is the
    fail-safe behavior required for old/partially authored rows.
    """
    parsed = parse_activity_variant(activity)
    valid_groups = {
        group for group in valid_variant_pairs(activities or [activity])
    }
    if parsed is None or parsed.group not in valid_groups:
        return ("activity", activity.id if activity.id is not None else activity.activity_uuid)
    return ("variant", f"{activity.course_id}:{parsed.group}")


def valid_variant_pairs(activities: Iterable[Activity]) -> dict[str, dict[str, Activity]]:
    """Return only exact purchased/unpurchased pairs from one course.

    A group is valid only when it has exactly two rows, one of each variant,
    with matching course and chapter membership.  Callers pass activities from
    one chapter for tree reads; direct reads pass all rows in the course.
    """
    grouped: dict[str, list[Activity]] = {}
    for activity in activities:
        parsed = parse_activity_variant(activity)
        if parsed is not None:
            grouped.setdefault(parsed.group, []).append(activity)

    pairs: dict[str, dict[str, Activity]] = {}
    for group, rows in grouped.items():
        if len(rows) != 2:
            continue
        parsed_rows = [(parse_activity_variant(row), row) for row in rows]
        variants = {parsed.variant for parsed, _ in parsed_rows if parsed is not None}
        if variants != {"purchased", "unpurchased"}:
            continue
        if len({row.course_id for _, row in parsed_rows}) != 1:
            continue
        # A ChapterActivity row is not present on the model.  Within a tree
        # read rows are already chapter-scoped; direct reads additionally use
        # the caller's course-scoped set.  Never infer pairing across courses.
        pairs[group] = {parsed.variant: row for parsed, row in parsed_rows if parsed is not None}
    return pairs


async def choose_activity_variant(
    activity: Activity,
    siblings: Iterable[Activity],
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> Activity:
    """Resolve one activity to the visible sibling, or return it unchanged."""
    parsed = parse_activity_variant(activity)
    if parsed is None:
        return activity
    pair = valid_variant_pairs(siblings).get(parsed.group)
    if pair is None:
        return activity

    selected_variant = "unpurchased"
    if not isinstance(current_user, AnonymousUser):
        purchased = pair["purchased"]
        accessible = await batch_accessible_restricted_uuids(
            current_user_id(current_user), [purchased.activity_uuid], db_session
        )
        if purchased.activity_uuid in accessible:
            selected_variant = "purchased"
    return pair[selected_variant]


def current_user_id(current_user: PublicUser | APITokenUser) -> int:
    # APITokenUser.id is a token id; the security helper unwraps its creator.
    from src.security.auth import resolve_acting_user_id

    return resolve_acting_user_id(current_user)


async def select_visible_activities(
    activities: list[Activity],
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> list[Activity]:
    """Filter a chapter/course list while retaining configured order."""
    pairs = valid_variant_pairs(activities)
    if not pairs:
        return activities
    accessible: set[str] = set()
    if not isinstance(current_user, AnonymousUser):
        purchased_ids = [pair["purchased"].activity_uuid for pair in pairs.values()]
        accessible = await batch_accessible_restricted_uuids(
            current_user_id(current_user), purchased_ids, db_session
        )
    selected: dict[str, Activity] = {}
    for group, pair in pairs.items():
        selected[group] = pair["purchased"] if pair["purchased"].activity_uuid in accessible else pair["unpurchased"]
    result: list[Activity] = []
    for activity in activities:
        parsed = parse_activity_variant(activity)
        if parsed is None:
            result.append(activity)
        elif selected.get(parsed.group) is activity:
            result.append(activity)
    return result


T = TypeVar("T")


def logical_keys(activities: Iterable[Activity]) -> set[tuple[str, str | int]]:
    rows = list(activities)
    return {logical_activity_key(activity, rows) for activity in rows}


async def count_logical_steps(course_id: int, db_session: AsyncSession, *, published_only: bool = False) -> int:
    statement = (
        select(Activity)
        .join(ChapterActivity, ChapterActivity.activity_id == Activity.id)
        .where(ChapterActivity.course_id == course_id)
    )
    if published_only:
        statement = statement.where(Activity.published == True)
    activities = (await db_session.execute(statement)).scalars().all()
    return len(logical_keys(activities))


async def count_completed_logical_steps(
    course_id: int,
    user_id: int,
    db_session: AsyncSession,
    *,
    published_only: bool = False,
) -> int:
    statement = (
        select(Activity)
        .join(ChapterActivity, ChapterActivity.activity_id == Activity.id)
        .join(TrailStep, TrailStep.activity_id == Activity.id)
        .where(
            ChapterActivity.course_id == course_id,
            TrailStep.course_id == course_id,
            TrailStep.user_id == user_id,
            TrailStep.complete == True,
        )
    )
    if published_only:
        statement = statement.where(Activity.published == True)
    activities = (await db_session.execute(statement)).scalars().all()
    return len(logical_keys(activities))


async def is_logical_activity_completed(
    activity: Activity,
    user_id: int,
    db_session: AsyncSession,
) -> bool:
    """Whether this activity's logical step already has a completion row."""
    siblings = (await db_session.execute(
        select(Activity).where(Activity.course_id == activity.course_id)
    )).scalars().all()
    rows = list(siblings)
    key = logical_activity_key(activity, rows)
    ids = [row.id for row in rows if row.id is not None and logical_activity_key(row, rows) == key]
    if not ids:
        ids = [activity.id] if activity.id is not None else []
    if not ids:
        return False
    return bool((await db_session.execute(
        select(TrailStep.id).where(
            TrailStep.user_id == user_id,
            TrailStep.course_id == activity.course_id,
            TrailStep.activity_id.in_(ids),  # type: ignore
            TrailStep.complete == True,
        )
    )).scalars().first())
