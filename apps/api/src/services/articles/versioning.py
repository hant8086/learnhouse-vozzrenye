from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import desc
from src.db.articles import Article, ArticleVersion, ArticleVersionRead, ArticleStateRead
from src.db.users import User, PublicUser, AnonymousUser
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import List, Optional

from src.security.auth import resolve_acting_user_id
from src.security.rbac import check_resource_access, AccessAction
from src.security.features_utils.usage import check_feature_access
from src.services.webhooks.dispatch import dispatch_webhooks

# Maximum number of versions to keep per article.
# Same cap/name pattern as activities' MAX_ACTIVITY_VERSIONS (see
# src/services/courses/activities/versioning.py) — change this constant to
# adjust how many saves are stored.
MAX_ARTICLE_VERSIONS = 20


async def create_article_version(
    article: Article,
    user_id: Optional[int],
    db_session: AsyncSession,
) -> ArticleVersion:
    """
    Creates a new version snapshot of the article content.
    Called before updating an article to preserve the current state.
    """
    # Create new version
    version = ArticleVersion(
        article_id=article.id,
        org_id=article.org_id,
        version_number=article.current_version,
        content=article.content,
        created_by_id=user_id,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )

    db_session.add(version)
    await db_session.commit()
    await db_session.refresh(version)

    # Cleanup old versions
    await cleanup_old_versions(article.id, db_session)

    await dispatch_webhooks(
        event_name="article_version_created",
        org_id=article.org_id,
        data={
            "article_id": article.id,
            "version_number": version.version_number,
            "created_by_id": user_id,
        },
    )

    return version


async def cleanup_old_versions(
    article_id: int,
    db_session: AsyncSession,
) -> None:
    """
    Removes old versions keeping only the last MAX_ARTICLE_VERSIONS.
    """
    # Get all versions for this article ordered by version number descending
    statement = (
        select(ArticleVersion)
        .where(ArticleVersion.article_id == article_id)
        .order_by(desc(ArticleVersion.version_number))
    )
    versions = (await db_session.execute(statement)).scalars().all()

    # Delete versions beyond the limit
    if len(versions) > MAX_ARTICLE_VERSIONS:
        versions_to_delete = versions[MAX_ARTICLE_VERSIONS:]
        for version in versions_to_delete:
            await db_session.delete(version)
        await db_session.commit()


async def get_article_versions(
    request: Request,
    article_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> List[ArticleVersionRead]:
    """
    Gets the version history for an article.
    Returns versions in descending order (newest first).
    """
    # Get article
    statement = select(Article).where(Article.article_uuid == article_uuid)
    article = (await db_session.execute(statement)).scalars().first()

    if not article:
        raise HTTPException(
            status_code=404,
            detail="Article not found",
        )

    # Check versioning feature access (requires standard plan or OSS mode)
    await check_feature_access("versioning", article.org_id, db_session)

    # RBAC check — article is its own access root, no parent course to check.
    await check_resource_access(request, db_session, current_user, article.article_uuid, AccessAction.READ)

    # Get versions with user info
    statement = (
        select(ArticleVersion, User)
        .outerjoin(User, ArticleVersion.created_by_id == User.id)
        .where(ArticleVersion.article_id == article.id)
        .order_by(desc(ArticleVersion.version_number))
        .offset(offset)
        .limit(limit)
    )
    results = (await db_session.execute(statement)).all()

    versions = []
    for version, user in results:
        version_read = ArticleVersionRead(
            id=version.id,
            article_id=version.article_id,
            org_id=version.org_id,
            version_number=version.version_number,
            content=version.content,
            created_at=version.created_at,
            created_by_username=user.username if user else None,
            created_by_avatar=user.avatar_image if user else None,
        )
        versions.append(version_read)

    return versions


async def get_article_version(
    request: Request,
    article_uuid: str,
    version_number: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ArticleVersionRead:
    """
    Gets a specific version of an article by version number.
    """
    # Get article
    statement = select(Article).where(Article.article_uuid == article_uuid)
    article = (await db_session.execute(statement)).scalars().first()

    if not article:
        raise HTTPException(
            status_code=404,
            detail="Article not found",
        )

    # Check versioning feature access (requires standard plan or OSS mode)
    await check_feature_access("versioning", article.org_id, db_session)

    # RBAC check
    await check_resource_access(request, db_session, current_user, article.article_uuid, AccessAction.READ)

    # Get specific version with user info
    statement = (
        select(ArticleVersion, User)
        .outerjoin(User, ArticleVersion.created_by_id == User.id)
        .where(
            ArticleVersion.article_id == article.id,
            ArticleVersion.version_number == version_number
        )
    )
    result = (await db_session.execute(statement)).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Version not found",
        )

    version, user = result
    return ArticleVersionRead(
        id=version.id,
        article_id=version.article_id,
        org_id=version.org_id,
        version_number=version.version_number,
        content=version.content,
        created_at=version.created_at,
        created_by_username=user.username if user else None,
        created_by_avatar=user.avatar_image if user else None,
    )


async def get_article_state(
    request: Request,
    article_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ArticleStateRead:
    """
    Gets the current state of an article for conflict detection.
    Returns lightweight info: update_date, current_version, last_modified_by.
    Used by frontend to check if remote state has changed.
    """
    # Get article with last modified user info
    statement = (
        select(Article, User)
        .outerjoin(User, Article.last_modified_by_id == User.id)
        .where(Article.article_uuid == article_uuid)
    )
    result = (await db_session.execute(statement)).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Article not found",
        )

    article, user = result

    # Check versioning feature access (requires standard plan or OSS mode)
    await check_feature_access("versioning", article.org_id, db_session)

    # RBAC check
    await check_resource_access(request, db_session, current_user, article.article_uuid, AccessAction.READ)

    return ArticleStateRead(
        article_uuid=article.article_uuid,
        update_date=article.update_date,
        current_version=article.current_version,
        last_modified_by_id=article.last_modified_by_id,
        last_modified_by_username=user.username if user else None,
    )


async def restore_article_version(
    request: Request,
    article_uuid: str,
    version_number: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> Article:
    """
    Restores an article to a specific version.
    Creates a new version with the restored content.
    """
    # Get article
    statement = select(Article).where(Article.article_uuid == article_uuid)
    article = (await db_session.execute(statement)).scalars().first()

    if not article:
        raise HTTPException(
            status_code=404,
            detail="Article not found",
        )

    # Check versioning feature access (requires standard plan or OSS mode)
    await check_feature_access("versioning", article.org_id, db_session)

    # RBAC check
    await check_resource_access(request, db_session, current_user, article.article_uuid, AccessAction.UPDATE)

    # Get the version to restore
    statement = (
        select(ArticleVersion)
        .where(
            ArticleVersion.article_id == article.id,
            ArticleVersion.version_number == version_number
        )
    )
    version = (await db_session.execute(statement)).scalars().first()

    if not version:
        raise HTTPException(
            status_code=404,
            detail="Version not found",
        )

    # Create a version of the current state before restoring. Unwrap API
    # tokens via resolve_acting_user_id — raw current_user.id is 0 on a
    # token, and created_by_id is an FK to user.id (writing 0 fails).
    user_id = resolve_acting_user_id(current_user)
    await create_article_version(article, user_id, db_session)

    # Restore content and update metadata
    article.content = version.content
    article.current_version = article.current_version + 1
    article.update_date = str(datetime.now())
    article.last_modified_by_id = user_id

    # Mark content as modified
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(article, "content")

    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)

    await dispatch_webhooks(
        event_name="article_version_restored",
        org_id=article.org_id,
        data={
            "article_uuid": article.article_uuid,
            "restored_version_number": version_number,
            "new_version_number": article.current_version,
        },
    )

    return article
