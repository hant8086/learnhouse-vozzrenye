"""Router tests for the authenticated user access endpoint."""

from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

import pytest

from src.core.events.database import get_db_session
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.routers.access import router as access_router
from src.security.api_token_utils import require_authenticated_user_or_api_token
from src.security.auth import get_current_user


@pytest.fixture
def app(db):
    app = FastAPI()
    app.include_router(
        access_router,
        prefix="/api/v1/access",
        dependencies=[Depends(require_authenticated_user_or_api_token)],
    )
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
async def authenticated_client(app, regular_user):
    app.dependency_overrides[require_authenticated_user_or_api_token] = (
        lambda: regular_user
    )
    app.dependency_overrides[get_current_user] = lambda: regular_user
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as async_client:
        yield async_client


async def _add_membership(
    db,
    *,
    user_id: int,
    org_id: int,
    usergroup_id: int,
    name: str,
    description: str,
    creation_date: str = "2026-08-12T10:00:00",
):
    db.add(
        UserGroup(
            id=usergroup_id,
            org_id=org_id,
            name=name,
            description=description,
            usergroup_uuid=f"usergroup_{usergroup_id}",
        )
    )
    db.add(
        UserGroupUser(
            usergroup_id=usergroup_id,
            user_id=user_id,
            org_id=org_id,
            creation_date=creation_date,
        )
    )
    await db.commit()


class TestAccessRouter:
    async def test_returns_all_memberships_sorted_by_usergroup_id(
        self, authenticated_client, db, org, regular_user
    ):
        await _add_membership(
            db,
            user_id=regular_user.id,
            org_id=org.id,
            usergroup_id=20,
            name="Later access",
            description="Second access",
            creation_date="2026-08-12T12:00:00",
        )
        await _add_membership(
            db,
            user_id=regular_user.id,
            org_id=org.id,
            usergroup_id=10,
            name="Earlier access",
            description="First access",
            creation_date="2026-08-12T10:00:00",
        )

        response = await authenticated_client.get(f"/api/v1/access/mine/org/{org.id}")

        assert response.status_code == 200
        assert response.json() == [
            {
                "usergroup_id": 10,
                "name": "Earlier access",
                "description": "First access",
                "granted_at": "2026-08-12T10:00:00",
            },
            {
                "usergroup_id": 20,
                "name": "Later access",
                "description": "Second access",
                "granted_at": "2026-08-12T12:00:00",
            },
        ]

    async def test_returns_empty_list_when_user_has_no_groups(
        self, authenticated_client, org
    ):
        response = await authenticated_client.get(f"/api/v1/access/mine/org/{org.id}")

        assert response.status_code == 200
        assert response.json() == []

    async def test_does_not_return_membership_from_another_organization(
        self, authenticated_client, db, org, other_org, regular_user
    ):
        await _add_membership(
            db,
            user_id=regular_user.id,
            org_id=other_org.id,
            usergroup_id=30,
            name="Other organization access",
            description="Must not leak",
        )

        response = await authenticated_client.get(f"/api/v1/access/mine/org/{org.id}")

        assert response.status_code == 200
        assert response.json() == []

    async def test_anonymous_call_returns_401(self, client, org):
        response = await client.get(f"/api/v1/access/mine/org/{org.id}")

        assert response.status_code == 401

    async def test_empty_creation_date_is_returned_as_null(
        self, authenticated_client, db, org, regular_user
    ):
        await _add_membership(
            db,
            user_id=regular_user.id,
            org_id=org.id,
            usergroup_id=40,
            name="Access without date",
            description="Date is optional",
            creation_date="",
        )

        response = await authenticated_client.get(f"/api/v1/access/mine/org/{org.id}")

        assert response.status_code == 200
        assert response.json() == [
            {
                "usergroup_id": 40,
                "name": "Access without date",
                "description": "Date is optional",
                "granted_at": None,
            }
        ]
