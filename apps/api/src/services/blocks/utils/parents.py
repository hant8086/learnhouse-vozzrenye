"""Resolve the parent a block hangs off.

A block belongs to an activity (course path) or an article (standalone path).
Every block service takes an opaque `parent_uuid` and routes through here so
the access check and the storage path stay in one place.
"""

from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.articles import Article
from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from src.db.organizations import Organization


@dataclass
class BlockParent:
    org_id: int
    org_uuid: str
    # The uuid whose access rules govern writes to this block: the course for
    # activities, the article itself for articles.
    access_uuid: str
    # Storage prefix under the media root.
    storage_prefix: str
    course_id: Optional[int] = None
    activity_id: Optional[int] = None
    article_id: Optional[int] = None


async def resolve_block_parent_for_block(block, db_session: AsyncSession) -> Optional[BlockParent]:
    """Resolve the BlockParent for an existing block row by its parent link.

    Used by the ``get_*_block`` readers so their IDOR check runs against the
    same ``parent.access_uuid`` as the ``create_*_block`` writers.
    """
    if block.activity_id is not None:
        activity = (await db_session.execute(
            select(Activity).where(Activity.id == block.activity_id)
        )).scalars().first()
        if not activity:
            return None
        return await resolve_block_parent(activity.activity_uuid, db_session)
    if block.article_id is not None:
        article = (await db_session.execute(
            select(Article).where(Article.id == block.article_id)
        )).scalars().first()
        if not article:
            return None
        return await resolve_block_parent(article.article_uuid, db_session)
    return None


async def resolve_block_parent(parent_uuid: str, db_session: AsyncSession) -> BlockParent:
    if parent_uuid.startswith("article_"):
        article = (await db_session.execute(
            select(Article).where(Article.article_uuid == parent_uuid)
        )).scalars().first()
        if not article:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Article not found")
        org = (await db_session.execute(
            select(Organization).where(Organization.id == article.org_id)
        )).scalars().first()
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Organization not found")
        return BlockParent(
            org_id=article.org_id,
            org_uuid=org.org_uuid,
            access_uuid=article.article_uuid,
            storage_prefix=f"articles/{article.article_uuid}",
            article_id=article.id,
        )

    activity = (await db_session.execute(
        select(Activity).where(Activity.activity_uuid == parent_uuid)
    )).scalars().first()
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Activity not found")
    org = (await db_session.execute(
        select(Organization).where(Organization.id == activity.org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Organization not found")
    course = (await db_session.execute(
        select(Course).where(Course.id == activity.course_id)
    )).scalars().first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Course not found")
    return BlockParent(
        org_id=activity.org_id,
        org_uuid=org.org_uuid,
        access_uuid=course.course_uuid,
        storage_prefix=f"courses/{course.course_uuid}/activities/{activity.activity_uuid}",
        course_id=course.id,
        activity_id=activity.id,
    )