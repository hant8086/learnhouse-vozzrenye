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
            await activity.record_user_activity(1, org_id=ORG)
        assert called["db"] is False

    async def test_no_org_ref_is_noop(self):
        from src.services.security import activity
        called = {"db": False}

        async def _fail_insert(*a, **k):
            called["db"] = True

        # No org id/slug/uuid resolvable -> nothing recorded.
        with _saas(), patch.object(activity, "_insert_activity_row", _fail_insert):
            await activity.record_user_activity(1)
        assert called["db"] is False

    async def test_never_raises_on_failure(self):
        from src.services.security import activity

        async def _boom(*a, **k):
            raise RuntimeError("db down")

        # Even if the DB insert path explodes, the caller must not see it.
        with _saas(), patch.object(activity, "_insert_activity_row", _boom):
            await activity.record_user_activity(1, org_id=ORG)  # must not raise


# ---------------------------------------------------------------------------
# Activity capture internals (src/services/security/activity.py)
# ---------------------------------------------------------------------------

from datetime import datetime, timezone  # noqa: E402
from types import SimpleNamespace  # noqa: E402
import asyncio  # noqa: E402

from sqlmodel import select, func as _func  # noqa: E402


class _FactoryCM:
    """Async CM that yields the test session without closing it."""
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *a):
        return False


def _patch_session_factory(db):
    # activity.py imports _async_session_factory from this module per-call.
    return patch("src.core.events.database._async_session_factory", lambda: _FactoryCM(db))


class _FakeRedis:
    def __init__(self, set_result):
        self._set_result = set_result
        self.store = {}

    def set(self, key, value, **kwargs):
        self.store[key] = value
        return self._set_result

    def get(self, key):
        return self.store.get(key)


async def _count_rows(db, org_id):
    stmt = select(_func.count()).select_from(UserActivityDay).where(
        UserActivityDay.org_id == org_id
    )
    return int((await db.execute(stmt)).scalar_one())


class TestActivityCapture:
    def test_seconds_until_utc_midnight_in_range(self):
        from src.services.security import activity
        secs = activity._seconds_until_utc_midnight()
        assert 1 <= secs <= 86400

    async def test_records_a_row_when_redis_absent(self, db, org):
        from src.services.security import activity
        with _saas(), _patch_session_factory(db), patch(
            "src.services.security.activity.get_redis_client", return_value=None
        ):
            await activity.record_user_activity(55, org_id=ORG)
        assert await _count_rows(db, ORG) == 1

    async def test_redis_guard_skips_db_when_already_touched(self, db, org):
        from src.services.security import activity
        with _saas(), _patch_session_factory(db), patch(
            "src.services.security.activity.get_redis_client",
            return_value=_FakeRedis(set_result=False),  # key already set today
        ):
            await activity.record_user_activity(56, org_id=ORG)
        assert await _count_rows(db, ORG) == 0

    async def test_redis_guard_allows_first_touch(self, db, org):
        from src.services.security import activity
        with _saas(), _patch_session_factory(db), patch(
            "src.services.security.activity.get_redis_client",
            return_value=_FakeRedis(set_result=True),  # first touch of the day
        ):
            await activity.record_user_activity(57, org_id=ORG)
        assert await _count_rows(db, ORG) == 1

    async def test_duplicate_same_day_is_idempotent(self, db, org):
        from src.services.security import activity
        with _saas(), _patch_session_factory(db), patch(
            "src.services.security.activity.get_redis_client", return_value=None
        ):
            await activity.record_user_activity(58, org_id=ORG)
            await activity.record_user_activity(58, org_id=ORG)  # second insert -> no-op
        assert await _count_rows(db, ORG) == 1

    async def test_resolve_org_id_passthrough(self):
        from src.services.security import activity
        assert await activity._resolve_org_id(42, None, None) == 42

    async def test_resolve_org_id_from_slug(self, db, org):
        from src.services.security import activity
        with _patch_session_factory(db), patch(
            "src.services.security.activity.get_redis_client", return_value=None
        ):
            resolved = await activity._resolve_org_id(None, "test-org", None)
        assert resolved == org.id

    async def test_resolve_org_id_from_uuid(self, db, org):
        from src.services.security import activity
        with _patch_session_factory(db), patch(
            "src.services.security.activity.get_redis_client", return_value=None
        ):
            resolved = await activity._resolve_org_id(None, None, "org_test")
        assert resolved == org.id

    async def test_resolve_org_id_none_when_no_ref(self):
        from src.services.security import activity
        assert await activity._resolve_org_id(None, None, None) is None


# ---------------------------------------------------------------------------
# Auth hook helpers (src/security/auth.py)
# ---------------------------------------------------------------------------

class TestAuthActivityHooks:
    def test_org_ref_from_path_id(self):
        from src.security.auth import _org_ref_from_request
        req = SimpleNamespace(path_params={"org_id": "7"}, query_params={})
        assert _org_ref_from_request(req) == (7, None, None)

    def test_org_ref_from_query_id(self):
        from src.security.auth import _org_ref_from_request
        req = SimpleNamespace(path_params={}, query_params={"org_id": "9"})
        assert _org_ref_from_request(req) == (9, None, None)

    def test_org_ref_from_slug_and_uuid(self):
        from src.security.auth import _org_ref_from_request
        req = SimpleNamespace(path_params={"org_slug": "acme", "org_uuid": "u1"}, query_params={})
        assert _org_ref_from_request(req) == (None, "acme", "u1")

    def test_org_ref_invalid_id_is_none(self):
        from src.security.auth import _org_ref_from_request
        req = SimpleNamespace(path_params={"org_id": "notint"}, query_params={})
        assert _org_ref_from_request(req) == (None, None, None)

    async def test_record_activity_from_request_schedules_touch(self):
        from src.security import auth
        captured = {}

        async def _fake_record(user_id, org_id=None, org_slug=None, org_uuid=None):
            captured["args"] = (user_id, org_id, org_slug, org_uuid)

        req = SimpleNamespace(path_params={"org_id": "3"}, query_params={})
        with patch("src.services.security.activity.record_user_activity", _fake_record):
            auth._record_activity_from_request(req, 88)
            await asyncio.sleep(0.02)  # let the fire-and-forget task run
        assert captured["args"] == (88, 3, None, None)

    async def test_record_activity_no_user_is_noop(self):
        from src.security import auth
        req = SimpleNamespace(path_params={"org_id": "3"}, query_params={})
        # Must not raise and must not schedule anything.
        auth._record_activity_from_request(req, None)
        await asyncio.sleep(0.01)


class TestEdgeBranches:
    async def test_december_month_bounds(self, db):
        # Exercises the December branch of _month_bounds (year rollover).
        await _add_days(db, ORG, 900, [date(2026, 12, 3), date(2026, 12, 20)])
        await _add_days(db, ORG, 901, [date(2027, 1, 2)])  # next year, excluded
        assert await count_active_users(ORG, 2026, 12, db) == 1

    async def test_visit_days_empty_user_list(self, db):
        assert await get_visit_days_for_users(ORG, [], 2026, 7, db) == {}
