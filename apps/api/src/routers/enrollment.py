"""Shared-secret user provisioning for the control plane.

The ``POST /api/v1/enrollment/provision`` route is authenticated with the
``X-Vozzrenye-Enrollment-Secret`` header and the
``VOZZRENYE_ENROLLMENT_SECRET`` environment variable.  This is a dedicated
machine-to-machine credential; it is not a user session or an API token.
"""

from contextlib import asynccontextmanager
import hmac
import os
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import AnonymousUser, InternalUser, User, UserCreate
from src.services.users.usergroups import add_users_to_usergroup
from src.services.users.users import create_user


ENROLLMENT_SECRET_ENV = "VOZZRENYE_ENROLLMENT_SECRET"
ENROLLMENT_SECRET_HEADER = "X-Vozzrenye-Enrollment-Secret"


async def require_enrollment_secret(request: Request) -> None:
    """Require the configured shared secret for every enrollment route."""
    expected_secret = os.environ.get(ENROLLMENT_SECRET_ENV, "")
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Enrollment secret is not configured",
        )

    provided_secret = request.headers.get(ENROLLMENT_SECRET_HEADER, "")
    if not hmac.compare_digest(provided_secret, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid enrollment secret",
        )


router = APIRouter(dependencies=[Depends(require_enrollment_secret)])


class ProvisionRequest(BaseModel):
    email: EmailStr
    org_id: int
    usergroup_id: int
    first_name: str | None = None
    last_name: str | None = None


class ProvisionResponse(BaseModel):
    user_id: int
    user_created: bool
    added_to_group: bool
    already_in_group: bool


@asynccontextmanager
async def _enrollment_advisory_lock(
    db_session: AsyncSession, normalized_email: str
):
    """Serialize provisioning for one email for the whole request.

    The production database is PostgreSQL, while the test harness is SQLite;
    only PostgreSQL supports the advisory lock used here.  A separate
    connection keeps the transaction-scoped lock alive across the commits in
    the existing user and usergroup services.
    """
    bind = getattr(db_session, "bind", None)
    if bind is None or getattr(bind.dialect, "name", None) != "postgresql":
        yield
        return

    async with bind.connect() as lock_connection:
        async with lock_connection.begin():
            await lock_connection.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:normalized_email))"),
                {"normalized_email": normalized_email},
            )
            yield


@router.post(
    "/provision",
    response_model=ProvisionResponse,
    summary="Provision a user into an organization usergroup",
    responses={
        200: {"description": "User provisioned and linked to the usergroup."},
        401: {"description": "Invalid enrollment secret."},
        404: {"description": "Organization or usergroup not found."},
        409: {"description": "Usergroup belongs to another organization."},
        503: {"description": "Enrollment secret is not configured."},
    },
)
async def provision_user(
    request: Request,
    body: ProvisionRequest,
    db_session: AsyncSession = Depends(get_db_session),
) -> ProvisionResponse:
    """Find or create a user, attach the organization, and link the group.

    Organization and usergroup ownership are validated before looking up or
    creating the user.  In particular, a usergroup ID from another
    organization is rejected before any database write can occur.
    """
    org_statement = select(Organization).where(Organization.id == body.org_id)
    organization = (await db_session.execute(org_statement)).scalars().first()
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    usergroup_statement = select(UserGroup).where(UserGroup.id == body.usergroup_id)
    usergroup = (await db_session.execute(usergroup_statement)).scalars().first()
    if usergroup is None:
        raise HTTPException(status_code=404, detail="UserGroup not found")
    if usergroup.org_id != organization.id:
        raise HTTPException(
            status_code=409,
            detail="UserGroup does not belong to the requested organization",
        )

    normalized_email = str(body.email).strip().lower()
    async with _enrollment_advisory_lock(db_session, normalized_email):
        # User.email, UserOrganization, and UserGroupUser currently have no
        # unique constraints in the create_all-managed production schema.
        # The lock serializes this endpoint, and the recovery below also
        # converges if a constraint is added later.
        user_statement = select(User).where(
            func.lower(User.email) == normalized_email
        )
        user = (await db_session.execute(user_statement)).scalars().first()
        user_created = False

        if user is None:
            # The password is deliberately generated only for hashing by the
            # existing user-creation service.  It is never returned or logged.
            generated_password = secrets.token_urlsafe(32)
            try:
                user = await create_user(
                    request,
                    db_session,
                    AnonymousUser(),
                    UserCreate(
                        username=normalized_email,
                        first_name=body.first_name or "",
                        last_name=body.last_name or "",
                        email=normalized_email,
                        password=generated_password,
                    ),
                    body.org_id,
                    is_oauth=True,
                    signup_provider="enrollment",
                )
                user_created = True
            except IntegrityError:
                await db_session.rollback()
                user = (
                    (await db_session.execute(user_statement)).scalars().first()
                )
                if user is None:
                    raise

        if user.id is None:
            raise HTTPException(status_code=500, detail="Provisioned user has no ID")

        membership_statement = select(UserOrganization).where(
            UserOrganization.user_id == user.id,
            UserOrganization.org_id == body.org_id,
        )
        membership = (
            await db_session.execute(membership_statement)
        ).scalars().first()
        if membership is None:
            db_session.add(
                UserOrganization(
                    user_id=user.id,
                    org_id=body.org_id,
                    role_id=4,
                    creation_date=str(datetime.now()),
                    update_date=str(datetime.now()),
                )
            )
            try:
                await db_session.commit()
            except IntegrityError:
                await db_session.rollback()
                membership = (
                    (await db_session.execute(membership_statement))
                    .scalars()
                    .first()
                )
                if membership is None:
                    raise

        group_link_statement = select(UserGroupUser).where(
            UserGroupUser.usergroup_id == body.usergroup_id,
            UserGroupUser.user_id == user.id,
        )
        group_link = (
            await db_session.execute(group_link_statement)
        ).scalars().first()
        already_in_group = group_link is not None

        if already_in_group:
            added_to_group = False
        else:
            try:
                await add_users_to_usergroup(
                    request,
                    db_session,
                    InternalUser(),
                    body.usergroup_id,
                    str(user.id),
                )
                added_to_group = True
            except IntegrityError:
                await db_session.rollback()
                group_link = (
                    (await db_session.execute(group_link_statement))
                    .scalars()
                    .first()
                )
                if group_link is None:
                    raise
                already_in_group = True
                added_to_group = False

        return ProvisionResponse(
            user_id=user.id,
            user_created=user_created,
            added_to_group=added_to_group,
            already_in_group=already_in_group,
        )
