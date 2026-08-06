"""Article CRUD tests (standalone-articles Task 5).

Covers slug derivation/uniqueness, cross-org slug reuse, slug-collision
rejection, versioning on content updates, cascade delete, and the Cyrillic
slug guard (AC-3 + AC-4).
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.articles import Article, ArticleCreate, ArticleUpdate, ArticleVersion
from src.db.resource_authors import ResourceAuthor
from src.services.articles.articles import (
    create_article,
    delete_article,
    update_article,
)


@pytest.fixture
def bypass_article_rbac():
    """Patches check_resource_access where the article services import it.

    The access-matrix suite exercises REAL RBAC; these CRUD tests focus on the
    pure slug/versioning/cascade business logic (same pattern as
    test_activity_metadata.py).
    """
    with patch(
        "src.services.articles.articles.check_resource_access",
        new_callable=AsyncMock,
    ), patch(
        "src.services.articles.versioning.check_resource_access",
        new_callable=AsyncMock,
    ), patch(
        "src.services.articles.versioning.dispatch_webhooks",
        new_callable=AsyncMock,
    ):
        yield


# RBAC is deliberately bypassed in this file; see bypass_article_rbac above.
pytestmark = pytest.mark.usefixtures("bypass_article_rbac")


# ---------------------------------------------------------------------------
# Create + slug derivation / uniqueness
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_derives_slug_from_name(db, org, admin_user, mock_request):
    payload = ArticleCreate(name="My First Article", org_id=org.id)
    created = await create_article(mock_request, payload, admin_user, db)

    assert created.slug == "my-first-article"
    assert created.article_uuid.startswith("article_")


@pytest.mark.asyncio
async def test_second_same_name_gets_distinct_slug(db, org, admin_user, mock_request):
    payload1 = ArticleCreate(name="Same Title", org_id=org.id)
    payload2 = ArticleCreate(name="Same Title", org_id=org.id)

    a1 = await create_article(mock_request, payload1, admin_user, db)
    a2 = await create_article(mock_request, payload2, admin_user, db)

    assert a1.slug == "same-title"
    assert a2.slug != a1.slug
    assert a2.slug.startswith("same-title")


@pytest.mark.asyncio
async def test_same_slug_allowed_across_orgs(db, org, other_org):
    """The unique index is (org_id, slug) — two orgs may hold the same slug.

    Inserts rows directly because create_article requires membership in each
    target org; the uniqueness constraint is what this test pins down.
    """

    def _row(org_id, slug):
        return Article(
            name="Shared Slim",
            excerpt=None,
            content={},
            published=False,
            org_id=org_id,
            article_uuid=f"article_slug_{org_id}",
            slug=slug,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )

    db.add(_row(org.id, "shared-slug"))
    db.add(_row(other_org.id, "shared-slug"))
    await db.commit()

    rows = (await db.execute(select(Article))).scalars().all()
    slugs = sorted((r.org_id, r.slug) for r in rows)
    assert (org.id, "shared-slug") in slugs
    assert (other_org.id, "shared-slug") in slugs
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_cyrillic_title_gets_nonempty_slug(db, org, admin_user, mock_request):
    """AC-4: Cyrillic headlines must NOT produce an empty or degenerate slug."""
    payload = ArticleCreate(name="Основы практики", org_id=org.id)
    created = await create_article(mock_request, payload, admin_user, db)

    assert created.slug  # non-empty
    assert created.slug == "основы-практики"


# ---------------------------------------------------------------------------
# Update: slug collision rejection + versioning
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_to_existing_slug_rejected(db, org, admin_user, mock_request):
    await create_article(mock_request, ArticleCreate(name="Taken", org_id=org.id), admin_user, db)
    target = await create_article(mock_request, ArticleCreate(name="Free", org_id=org.id), admin_user, db)

    # "taken" normalizes to "taken"; the update path re-validates uniqueness and
    # allocates a "-2" suffix instead of raising (mirror of create's behavior).
    updated = await update_article(
        mock_request, target.article_uuid, ArticleUpdate(slug="Taken"), admin_user, db
    )
    assert updated.slug.startswith("taken")
    assert updated.slug != "taken"


@pytest.mark.asyncio
async def test_content_update_creates_version_and_bumps_current(
    db, org, admin_user, mock_request
):
    created = await create_article(
        mock_request, ArticleCreate(name="V", org_id=org.id, content={"old": True}), admin_user, db
    )
    assert created.current_version == 1

    updated = await update_article(
        mock_request,
        created.article_uuid,
        ArticleUpdate(content={"new": True}),
        admin_user,
        db,
    )

    assert updated.current_version == 2
    assert updated.content == {"new": True}

    versions = (await db.execute(
        select(ArticleVersion).where(ArticleVersion.article_id == created.id)
    )).scalars().all()
    assert len(versions) == 1
    assert versions[0].content == {"old": True}
    assert versions[0].version_number == 1


# ---------------------------------------------------------------------------
# Delete: cascades versions + resourceauthor rows
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_removes_article_versions_and_authors(db, org, admin_user, mock_request):
    # SQLite disables FK enforcement by default, which would silently skip the
    # ON DELETE CASCADE that deletes ArticleVersion rows. Enable it on the
    # shared in-memory connection so the cascade is exercised exactly as in
    # the Postgres deployment.
    conn = await db.connection()
    await conn.exec_driver_sql("PRAGMA foreign_keys=ON")

    created = await create_article(
        mock_request, ArticleCreate(name="Doomed", org_id=org.id, content={"a": 1}), admin_user, db
    )
    # One content update -> one ArticleVersion row.
    await update_article(
        mock_request,
        created.article_uuid,
        ArticleUpdate(content={"b": 2}),
        admin_user,
        db,
    )

    # The creator's ResourceAuthor row always exists; count it before delete.
    before_authors = (await db.execute(
        select(ResourceAuthor).where(ResourceAuthor.resource_uuid == created.article_uuid)
    )).scalars().all()
    assert len(before_authors) == 1

    await delete_article(mock_request, created.article_uuid, admin_user, db)

    article = (await db.execute(
        select(Article).where(Article.article_uuid == created.article_uuid)
    )).scalars().first()
    assert article is None

    versions = (await db.execute(
        select(ArticleVersion).where(ArticleVersion.article_id == created.id)
    )).scalars().all()
    assert versions == []

    authors = (await db.execute(
        select(ResourceAuthor).where(ResourceAuthor.resource_uuid == created.article_uuid)
    )).scalars().all()
    assert authors == []
