"""Router tests for the shared-secret enrollment endpoint."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlmodel import select

from src.core.events.database import get_db_session
from src.db.user_organizations import UserOrganization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User, UserRead
from src.routers.enrollment import (
    ENROLLMENT_SECRET_ENV,
    router as enrollment_router,
)


@pytest.fixture
def app(db, monkeypatch):
    monkeypatch.setenv(ENROLLMENT_SECRET_ENV, "enrollment-test-secret")
    app = FastAPI()
    app.include_router(enrollment_router, prefix="/api/v1/enrollment")
    app.dependency_overrides[get_db_session] = lambda: db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as async_client:
        yield async_client


@pytest.fixture
async def usergroup(db, org):
    group = UserGroup(
        org_id=org.id,
        name="Enrolled buyers",
        description="Provisioned users",
        usergroup_uuid="usergroup_enrolled",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@pytest.fixture
async def other_usergroup(db, other_org):
    group = UserGroup(
        org_id=other_org.id,
        name="Other org buyers",
        description="Provisioned users",
        usergroup_uuid="usergroup_other_enrolled",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


async def _fake_create_user(
    request,
    db_session,
    current_user,
    user_object,
    org_id,
    **kwargs,
):
    user = User(
        username=user_object.username,
        first_name=user_object.first_name,
        last_name=user_object.last_name,
        email=str(user_object.email),
        password="hashed-test-password",
        user_uuid="user_enrolled",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(
        UserOrganization(
            user_id=user.id,
            org_id=org_id,
            role_id=4,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db_session.commit()
    return UserRead.model_validate(user)


class TestEnrollmentRouter:
    async def test_provisions_once_and_is_idempotent(
        self, client, db, org, usergroup
    ):
        seen_passwords = []

        async def fake_create_user_with_capture(*args, **kwargs):
            seen_passwords.append(args[3].password)
            return await _fake_create_user(*args, **kwargs)

        payload = {
            "email": "  Buyer@Example.COM ",
            "org_id": org.id,
            "usergroup_id": usergroup.id,
            "first_name": "Buyer",
            "last_name": "Example",
        }
        headers = {"X-Vozzrenye-Enrollment-Secret": "enrollment-test-secret"}

        with patch(
            "src.routers.enrollment.create_user",
            new=AsyncMock(side_effect=fake_create_user_with_capture),
        ) as create_user_mock:
            first = await client.post(
                "/api/v1/enrollment/provision", json=payload, headers=headers
            )
            second = await client.post(
                "/api/v1/enrollment/provision", json=payload, headers=headers
            )

        assert first.status_code == 200
        assert first.json() == {
            "user_id": first.json()["user_id"],
            "user_created": True,
            "added_to_group": True,
            "already_in_group": False,
        }
        assert second.status_code == 200
        assert second.json() == {
            "user_id": first.json()["user_id"],
            "user_created": False,
            "added_to_group": False,
            "already_in_group": True,
        }
        assert create_user_mock.await_count == 1
        assert len(seen_passwords) == 1
        assert len(seen_passwords[0]) >= 40
        assert "password" not in first.json()

        users = (await db.execute(select(User))).scalars().all()
        memberships = (await db.execute(select(UserOrganization))).scalars().all()
        group_links = (await db.execute(select(UserGroupUser))).scalars().all()
        assert len(users) == 1
        assert len(memberships) == 1
        assert len(group_links) == 1

    async def test_invalid_secret_is_rejected(self, client, usergroup, org):
        response = await client.post(
            "/api/v1/enrollment/provision",
            json={
                "email": "buyer@example.com",
                "org_id": org.id,
                "usergroup_id": usergroup.id,
            },
            headers={"X-Vozzrenye-Enrollment-Secret": "wrong-secret"},
        )

        assert response.status_code == 401

    async def test_missing_secret_configuration_returns_503(
        self, client, monkeypatch, usergroup, org
    ):
        monkeypatch.delenv(ENROLLMENT_SECRET_ENV)

        response = await client.post(
            "/api/v1/enrollment/provision",
            json={
                "email": "buyer@example.com",
                "org_id": org.id,
                "usergroup_id": usergroup.id,
            },
        )

        assert response.status_code == 503

    async def test_cross_org_usergroup_is_rejected_before_write(
        self, client, db, org, other_usergroup
    ):
        create_user_mock = AsyncMock(side_effect=_fake_create_user)
        with patch("src.routers.enrollment.create_user", new=create_user_mock):
            response = await client.post(
                "/api/v1/enrollment/provision",
                json={
                    "email": "buyer@example.com",
                    "org_id": org.id,
                    "usergroup_id": other_usergroup.id,
                },
                headers={"X-Vozzrenye-Enrollment-Secret": "enrollment-test-secret"},
            )

        assert response.status_code == 409
        create_user_mock.assert_not_awaited()
        assert (await db.execute(select(User))).scalars().all() == []
        assert (await db.execute(select(UserOrganization))).scalars().all() == []
        assert (await db.execute(select(UserGroupUser))).scalars().all() == []
