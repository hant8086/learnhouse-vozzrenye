"""
Best-effort user-activity tracking for active-user billing.

An "active user" is a member seen on the site on at least 2 distinct UTC
calendar days in a month. This module records one row per (org, user, day)
so that count is authoritative. Everything here is best-effort: it must never
raise into a request path, and it is a no-op outside SaaS mode.
"""

import logging
from datetime import date, datetime, timezone

from src.security.features_utils.usage import _is_non_saas
from src.core.redis import get_redis_client

logger = logging.getLogger(__name__)


def _seconds_until_utc_midnight() -> int:
    """Seconds remaining until the next UTC midnight (>=1)."""
    now = datetime.now(timezone.utc)
    tomorrow = date.fromordinal(now.date().toordinal() + 1)
    midnight = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)
    return max(1, int((midnight - now).total_seconds()))


async def _insert_activity_row(org_id: int, user_id: int, day: date) -> None:
    """Insert today's activity row in its own short-lived session.

    Uses a dedicated session (not the request's mid-transaction session) so
    committing the activity row never flushes/commits request work. Idempotent
    across dialects: a duplicate (same org/user/day) hits the unique constraint
    and is silently ignored — the row already exists.
    """
    from sqlalchemy.exc import IntegrityError
    from src.core.events.database import _async_session_factory
    from src.db.user_activity import UserActivityDay

    async with _async_session_factory() as session:
        session.add(
            UserActivityDay(org_id=org_id, user_id=user_id, activity_date=day)
        )
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()  # already recorded today — no-op


async def record_user_activity(org_id: int, user_id: int) -> None:
    """
    Mark (org, user) active for today's UTC date. Best-effort, never raises.

    Cheap Redis SETNX day-key guards the DB so the insert runs at most once
    per user/org/day; every other request is a single Redis round-trip. When
    Redis is unavailable the DB insert still runs (idempotent via the unique
    constraint), so tracking degrades gracefully rather than silently dropping.
    """
    try:
        if _is_non_saas():
            return
        if not org_id or not user_id:
            return

        today = datetime.now(timezone.utc).date()

        r = get_redis_client()
        if r is not None:
            try:
                key = f"activity_touched:{org_id}:{user_id}:{today.isoformat()}"
                # If the key already exists we've written today's row -> skip DB.
                if not r.set(key, "1", nx=True, ex=_seconds_until_utc_midnight()):
                    return
            except Exception:
                logger.debug("activity Redis guard failed; falling through to DB", exc_info=True)

        await _insert_activity_row(org_id, user_id, today)
    except Exception:
        logger.debug("record_user_activity failed (non-fatal)", exc_info=True)
