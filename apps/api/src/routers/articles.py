from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request

from src.db.articles import (
    ArticleCreate,
    ArticleRead,
    ArticleStateRead,
    ArticleUpdate,
    ArticleVersionRead,
)
from src.db.users import PublicUser
from src.core.events.database import get_db_session
from src.security.auth import get_current_user
from src.services.articles.articles import (
    create_article,
    delete_article,
    get_article,
    list_articles,
    update_article,
)
from src.services.articles.versioning import (
    get_article_state,
    get_article_version,
    get_article_versions,
    restore_article_version,
)
from src.services.courses.lock_usergroups import (
    add_usergroup_to_article,
    get_article_usergroups,
    remove_usergroup_from_article,
)

router = APIRouter()


# Versioning, state and slug routes MUST be declared before the bare
# /{article_uuid} catch-all routes, or FastAPI will match the catch-all first
# and swallow the longer paths. Same warning the activities router carries.


@router.post(
    "/",
    response_model=ArticleRead,
    summary="Create article",
    description="Create a new standalone article. The authenticated user must have create permission on articles in the target org.",
    responses={
        200: {"description": "Article created and returned.", "model": ArticleRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to create articles in this org"},
        404: {"description": "Organization not found"},
    },
)
async def api_create_article(
    request: Request,
    article_object: ArticleCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleRead:
    """
    Create new article
    """
    return await create_article(request, article_object, current_user, db_session)


@router.get(
    "/",
    response_model=List[ArticleRead],
    summary="List articles",
    description="Catalog read for an org's articles. Locked articles appear as teasers (name, thumbnail, excerpt) with is_locked=true and empty content.",
    responses={
        200: {
            "description": "List of articles for the org.",
            "model": List[ArticleRead],
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this org's articles"},
        404: {"description": "Organization not found"},
    },
)
async def api_list_articles(
    request: Request,
    org_id: int = Query(..., description="Organization ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> List[ArticleRead]:
    """
    List articles for an organization.
    """
    return await list_articles(
        request, org_id, current_user, db_session, page=page, limit=limit
    )


@router.get(
    "/{article_uuid}/versions",
    response_model=List[ArticleVersionRead],
    summary="List article versions",
    description="Get the version history for an article, ordered newest first. Supports pagination via limit and offset.",
    responses={
        200: {
            "description": "List of article versions.",
            "model": List[ArticleVersionRead],
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this article's versions"},
        404: {"description": "Article not found"},
    },
)
async def api_get_article_versions(
    request: Request,
    article_uuid: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> List[ArticleVersionRead]:
    """
    Get version history for an article.
    Returns versions in descending order (newest first).
    """
    return await get_article_versions(
        request, article_uuid, current_user, db_session, limit, offset
    )


@router.get(
    "/{article_uuid}/versions/{version_number}",
    response_model=ArticleVersionRead,
    summary="Get article version",
    description="Get a specific historical version of an article by its version number.",
    responses={
        200: {
            "description": "Article version returned.",
            "model": ArticleVersionRead,
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this article version"},
        404: {"description": "Article or version not found"},
    },
)
async def api_get_article_version(
    request: Request,
    article_uuid: str,
    version_number: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleVersionRead:
    """
    Get a specific version of an article.
    """
    return await get_article_version(
        request, article_uuid, version_number, current_user, db_session
    )


@router.get(
    "/{article_uuid}/state",
    response_model=ArticleStateRead,
    summary="Get article state",
    description="Get the current state of an article for conflict detection. Returns lightweight info (update_date, current_version, last_modified_by) used by the frontend to detect remote changes.",
    responses={
        200: {"description": "Current article state.", "model": ArticleStateRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this article"},
        404: {"description": "Article not found"},
    },
)
async def api_get_article_state(
    request: Request,
    article_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleStateRead:
    """
    Get the current state of an article for conflict detection.
    Returns lightweight info: update_date, current_version, last_modified_by.
    Used by frontend to check if remote state has changed.
    """
    return await get_article_state(request, article_uuid, current_user, db_session)


@router.post(
    "/{article_uuid}/versions/{version_number}/restore",
    response_model=ArticleRead,
    summary="Restore article version",
    description="Restore an article to a previous version. Creates a new version with the restored content rather than rewriting history.",
    responses={
        200: {
            "description": "Article restored; returns the updated article.",
            "model": ArticleRead,
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to restore this article"},
        404: {"description": "Article or version not found"},
    },
)
async def api_restore_article_version(
    request: Request,
    article_uuid: str,
    version_number: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleRead:
    """
    Restore an article to a specific version.
    Creates a new version with the restored content.
    """
    article = await restore_article_version(
        request, article_uuid, version_number, current_user, db_session
    )
    return ArticleRead.model_validate(article)


@router.get(
    "/slug/{org_id}/{slug}",
    response_model=ArticleRead,
    summary="Get article by slug",
    description="Get a single article by its org-scoped slug.",
    responses={
        200: {"description": "Article returned.", "model": ArticleRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this article"},
        404: {"description": "Article not found"},
    },
)
async def api_get_article_by_slug(
    request: Request,
    org_id: int,
    slug: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleRead:
    """
    Get single article by slug (org-scoped).
    """
    return await get_article(
        request, slug, org_id, current_user=current_user, db_session=db_session
    )


@router.get(
    "/{article_uuid}",
    response_model=ArticleRead,
    summary="Get article by UUID",
    description="Get a single article by its article_<uuid> identifier. Available to anonymous callers for public and gated (excerpt-only) articles.",
    responses={
        200: {"description": "Article returned.", "model": ArticleRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this article"},
        404: {"description": "Article not found"},
    },
)
async def api_get_article(
    request: Request,
    article_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleRead:
    """
    Get single article by its article_<uuid> identifier.
    """
    return await get_article(
        request, article_uuid, None, current_user=current_user, db_session=db_session
    )


@router.put(
    "/{article_uuid}",
    response_model=ArticleRead,
    summary="Update article",
    description="Update an article's fields by its UUID. Creates a new version when content changes.",
    responses={
        200: {"description": "Article updated and returned.", "model": ArticleRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to update this article"},
        404: {"description": "Article not found"},
    },
)
async def api_update_article(
    request: Request,
    article_uuid: str,
    article_object: ArticleUpdate,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ArticleRead:
    """
    Update article by its article_<uuid> identifier.
    """
    return await update_article(
        request, article_uuid, article_object, current_user, db_session
    )


@router.delete(
    "/{article_uuid}",
    summary="Delete article",
    description="Delete an article by its UUID. The authenticated user must have permission to delete this article.",
    responses={
        200: {"description": "Article deleted."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to delete this article"},
        404: {"description": "Article not found"},
    },
)
async def api_delete_article(
    request: Request,
    article_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Delete article by its article_<uuid> identifier.
    """
    return await delete_article(request, article_uuid, current_user, db_session)


# User-group lock management — article is its own access root, so these check
# UPDATE/READ on the article itself (no parent course).


@router.get(
    "/{article_uuid}/usergroups",
    summary="List user groups assigned to a locked article",
    description="Return the user groups that can access this article when lock_type is 'restricted'.",
)
async def api_list_article_usergroups(
    request: Request,
    article_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    return await get_article_usergroups(
        request, article_uuid, current_user, db_session
    )


@router.post(
    "/{article_uuid}/usergroups/{usergroup_uuid}",
    summary="Grant a user group access to a locked article",
    description="Associate a user group with this article so its members can access it when lock_type is 'restricted'.",
)
async def api_add_article_usergroup(
    request: Request,
    article_uuid: str,
    usergroup_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    return await add_usergroup_to_article(
        request, article_uuid, usergroup_uuid, current_user, db_session
    )


@router.delete(
    "/{article_uuid}/usergroups/{usergroup_uuid}",
    summary="Revoke a user group's access to a locked article",
    description="Remove the association between a user group and this article.",
)
async def api_remove_article_usergroup(
    request: Request,
    article_uuid: str,
    usergroup_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    return await remove_usergroup_from_article(
        request, article_uuid, usergroup_uuid, current_user, db_session
    )