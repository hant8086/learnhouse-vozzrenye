from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import APITokenUser, PublicUser, SuperadminAPITokenUser
from src.security.auth import get_current_user


router = APIRouter()


class AccessRead(BaseModel):
    usergroup_id: int
    name: str
    description: str
    granted_at: Optional[str] = None


def _get_current_user_id(
    current_user: PublicUser | APITokenUser | SuperadminAPITokenUser,
) -> int:
    """Return the user represented by the authenticated principal.

    API-token principals carry the token row's id in ``id``. Their creator is
    the user whose access is being queried.
    """
    if isinstance(current_user, (APITokenUser, SuperadminAPITokenUser)):
        return current_user.created_by_user_id
    return current_user.id


@router.get(
    "/mine/org/{org_id}",
    response_model=list[AccessRead],
    summary="List my organization access",
    responses={
        200: {"description": "The caller's usergroup memberships."},
        401: {"description": "Authentication required"},
    },
)
async def get_my_access(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser | APITokenUser | SuperadminAPITokenUser = Depends(
        get_current_user
    ),
) -> list[AccessRead]:
    statement = (
        select(
            UserGroupUser.usergroup_id,
            UserGroup.name,
            UserGroup.description,
            UserGroupUser.creation_date,
        )
        .join(UserGroup, UserGroup.id == UserGroupUser.usergroup_id)
        .where(
            UserGroupUser.org_id == org_id,
            UserGroupUser.user_id == _get_current_user_id(current_user),
        )
        .order_by(UserGroupUser.usergroup_id)
    )
    rows = (await db_session.execute(statement)).all()

    return [
        AccessRead(
            usergroup_id=usergroup_id,
            name=name,
            description=description,
            granted_at=creation_date or None,
        )
        for usergroup_id, name, description, creation_date in rows
    ]
