"""Tests for active-user tracking + billing (src/security/features_utils/active_users.py)."""

from contextlib import ExitStack
from datetime import date
from unittest.mock import patch

import pytest

from src.db.user_activity import UserActivityDay
from src.db.user_organizations import UserOrganization
from src.security.features_utils.active_users import (
    ACTIVE_USER_OVERAGE_PRICE_USD,
    calculate_active_user_overage,
    count_active_users,
    get_active_user_summary,
    get_all_orgs_with_active_user_overage,
    get_member_active_status,
    get_visit_days_for_users,
)

ORG = 1
OTHER_ORG = 2


def _mode(mode: str):
    """Patch deployment mode everywhere it is resolved.

    usage.py binds get_deployment_mode at import time (module attr), while
    plans.py imports it per-call (source attr) — patch both so limits and the
    saas gate agree.
    """
    stack = ExitStack()
    stack.enter_context(
        patch("src.core.deployment_mode.get_deployment_mode", return_value=mode)
    )
    stack.enter_context(
        patch("src.security.features_utils.usage.get_deployment_mode", return_value=mode)
    )
    return stack


def _saas():
    return _mode("saas")


def _oss():
    return _mode("oss")


async def _add_days(db, org_id, user_id, days: list[date]):
    for d in days:
        db.add(UserActivityDay(org_id=org_id, user_id=user_id, activity_date=d))
    await db.commit()


async def _add_member(db, org_id, user_id):
    db.add(
        UserOrganization(
            user_id=user_id, org_id=org_id, role_id=1,
            creation_date="2026-01-01", update_date="2026-01-01",
        )
    )
    await db.commit()


class TestCountActiveUsers:
    async def test_threshold_two_distinct_days(self, db):
        await _add_days(db, ORG, 10, [date(2026, 7, 1), date(2026, 7, 2)])   # active
        await _add_days(db, ORG, 11, [date(2026, 7, 5)])                      # 1 day -> not
        await _add_days(db, ORG, 12, [date(2026, 7, 3), date(2026, 7, 9), date(2026, 7, 20)])  # active
        assert await count_active_users(ORG, 2026, 7, db) == 2

    async def test_month_boundary_is_respected(self, db):
        # One day in July, one in August -> not active in either month.
        await _add_days(db, ORG, 20, [date(2026, 7, 31), date(2026, 8, 1)])
        assert await count_active_users(ORG, 2026, 7, db) == 0
        assert await count_active_users(ORG, 2026, 8, db) == 0

    async def test_org_scoped(self, db):
        await _add_days(db, ORG, 30, [date(2026, 7, 1), date(2026, 7, 2)])
        await _add_days(db, OTHER_ORG, 30, [date(2026, 7, 1), date(2026, 7, 2)])
        assert await count_active_users(ORG, 2026, 7, db) == 1
        assert await count_active_users(OTHER_ORG, 2026, 7, db) == 1

    async def test_same_day_is_deduped_by_unique_constraint(self, db):
        from sqlalchemy.exc import IntegrityError
        await _add_days(db, ORG, 40, [date(2026, 7, 1)])
        db.add(UserActivityDay(org_id=ORG, user_id=40, activity_date=date(2026, 7, 1)))
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()
        # Still just one day -> not active.
        assert await count_active_users(ORG, 2026, 7, db) == 0


class TestMemberActiveStatus:
    async def test_zero_visit_members_appear(self, db):
        await _add_member(db, ORG, 100)   # no activity
        await _add_member(db, ORG, 101)   # active
        await _add_days(db, ORG, 101, [date(2026, 7, 1), date(2026, 7, 4)])

        status = await get_member_active_status(ORG, 2026, 7, db)
        assert status[100] == {"visit_days": 0, "is_active": False}
        assert status[101] == {"visit_days": 2, "is_active": True}

    async def test_visit_days_for_users_targeted(self, db):
        await _add_days(db, ORG, 200, [date(2026, 7, 1), date(2026, 7, 2), date(2026, 7, 3)])
        await _add_days(db, ORG, 201, [date(2026, 7, 1)])
        result = await get_visit_days_for_users(ORG, [200, 201, 999], 2026, 7, db)
        assert result == {200: 3, 201: 1}  # 999 absent (no activity)


class TestOverage:
    async def test_overage_units_and_price(self, db):
        for uid in range(300, 305):  # 5 active users
            await _add_days(db, ORG, uid, [date(2026, 7, 1), date(2026, 7, 2)])
        out = await calculate_active_user_overage(ORG, 2026, 7, plan_limit=3, db_session=db)
        assert out["active_users"] == 5
        assert out["overage_units"] == 2
        assert out["overage_usd"] == 2 * ACTIVE_USER_OVERAGE_PRICE_USD

    async def test_no_overage_when_under_limit(self, db):
        await _add_days(db, ORG, 310, [date(2026, 7, 1), date(2026, 7, 2)])
        out = await calculate_active_user_overage(ORG, 2026, 7, plan_limit=200, db_session=db)
        assert out["overage_units"] == 0
        assert out["overage_usd"] == 0

    async def test_unlimited_plan_never_overages(self, db):
        for uid in range(320, 325):
            await _add_days(db, ORG, uid, [date(2026, 7, 1), date(2026, 7, 2)])
        out = await calculate_active_user_overage(ORG, 2026, 7, plan_limit=0, db_session=db)
        assert out["overage_units"] == 0
        assert out["limit"] == "unlimited"


class TestSummaryAndBatch:
    async def test_summary_non_saas_has_no_overage(self, db):
        for uid in range(400, 415):  # 15 active users
            await _add_days(db, ORG, uid, [date(2026, 7, 1), date(2026, 7, 2)])
        with _oss():
            summary = await get_active_user_summary(ORG, db, year=2026, month=7)
        assert summary["plan_limit"] == 0
        assert summary["overage_units"] == 0

    async def test_summary_saas_free_plan_limit(self, db):
        # No org config row -> plan falls back to "free" (member limit 10).
        for uid in range(500, 512):  # 12 active users
            await _add_days(db, ORG, uid, [date(2026, 7, 1), date(2026, 7, 2)])
        with _saas():
            summary = await get_active_user_summary(ORG, db, year=2026, month=7)
        assert summary["plan"] == "free"
        assert summary["plan_limit"] == 10
        assert summary["active_users"] == 12
        assert summary["overage_units"] == 2

    async def test_batch_only_returns_orgs_over_limit(self, db):
        # ORG over the free limit (12 > 10), OTHER_ORG under it (3).
        for uid in range(600, 612):
            await _add_days(db, ORG, uid, [date(2026, 7, 1), date(2026, 7, 2)])
        for uid in range(700, 703):
            await _add_days(db, OTHER_ORG, uid, [date(2026, 7, 1), date(2026, 7, 2)])
        with _saas():
            rows = await get_all_orgs_with_active_user_overage(2026, 7, db)
        org_ids = {r["org_id"] for r in rows}
        assert ORG in org_ids
        assert OTHER_ORG not in org_ids


class TestRecordActivity:
    async def test_non_saas_is_noop(self):
        from src.services.security import activity
        called = {"db": False}

        async def _fail_insert(*a, **k):
            called["db"] = True

        with _oss(), patch.object(activity, "_insert_activity_row", _fail_insert):
            await activity.record_user_activity(ORG, 1)
        assert called["db"] is False

    async def test_never_raises_on_failure(self):
        from src.services.security import activity

        async def _boom(*a, **k):
            raise RuntimeError("db down")

        # Even if the DB insert path explodes, the caller must not see it.
        with _saas(), patch.object(activity, "_insert_activity_row", _boom):
            await activity.record_user_activity(ORG, 1)  # must not raise
