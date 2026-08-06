from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, Request

from src.db.articles import Article, ArticleCreate, ArticleRead, ArticleUpdate
from src.db.courses.courses import AuthorWithRole
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User, UserRead
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import require_org_membership
from src.security.rbac import AccessAction, check_resource_access
from src.services.articles.versioning import create_article_version
from src.services.courses.locks import (
    batch_accessible_restricted_uuids,
    is_locked_for_user,
    is_org_admin,
)

# Cap applied to every derived/normalized slug (matches the unique index's
# comfortable width and keeps URLs sane).
MAX_SLUG_LENGTH = 80

# Bounded retries when the pre-check for slug uniqueness loses a race against
# a concurrent insert (see _unique_slug / create_article / update_article).
MAX_SLUG_COLLISION_RETRIES = 5


####################################################
# Slug helpers
####################################################


def _slugify(value: str) -> str:
    """Derive a URL-safe slug from arbitrary (possibly Cyrillic) text.

    Lowercase, collapse any run of non-alphanumeric characters into a single
    '-', strip leading/trailing '-', truncate to MAX_SLUG_LENGTH.

    Unicode decision: ``str.isalnum()`` is unicode-aware, so Cyrillic (and any
    other script's) letters count as alphanumeric and are kept as-is rather
    than stripped. A title like "Основы практики" becomes
    "основы-практики", not "" or a bare numeric suffix. We deliberately do NOT
    transliterate to Latin — keeping the source script makes the slug legible
    to the people who wrote and read the article, and avoids maintaining a
    transliteration table for every script Vozzrenye content might use.
    """
    lowered = value.lower()
    chars: list[str] = []
    prev_dash = True  # start true so we never emit a leading '-'
    for ch in lowered:
        if ch.isalnum():
            chars.append(ch)
            prev_dash = False
        elif not prev_dash:
            chars.append("-")
            prev_dash = True
    slug = "".join(chars).rstrip("-")
    # Truncating can leave a trailing '-' right at the cut point; strip again.
    return slug[:MAX_SLUG_LENGTH].rstrip("-")


async def _unique_slug(
    org_id: int,
    base_slug: str,
    db_session: AsyncSession,
    *,
    exclude_id: Optional[int] = None,
) -> str:
    """Return a slug unique within org_id, appending -2, -3, ... on collision.

    This is a pre-check only — it narrows the odds but does not itself
    prevent a race between two concurrent creates/updates picking the same
    candidate. Callers must still handle IntegrityError from the unique index
    (ix_article_org_slug) on the actual insert/commit.
    """
    base = base_slug or "article"
    slug = base
    suffix = 1
    while True:
        statement = select(Article.id).where(
            Article.org_id == org_id, Article.slug == slug
        )
        if exclude_id is not None:
            statement = statement.where(Article.id != exclude_id)
        existing = (await db_session.execute(statement)).scalars().first()
        if not existing:
            return slug
        suffix += 1
        tail = f"-{suffix}"
        slug = f"{base[: MAX_SLUG_LENGTH - len(tail)]}{tail}"


####################################################
# Lock enforcement
####################################################


async def _apply_article_lock(
    article_read: ArticleRead,
    article: Article,
    current_user,
    db_session: AsyncSession,
    *,
    accessible_restricted_uuids: Optional[set] = None,
    is_admin: Optional[bool] = None,
) -> None:
    """Enforce lock_type on a single-article read.

    Org admins/maintainers bypass. For everyone else, when the article is
    locked we drop the body and flag it, leaving `excerpt` as the only body
    text on the wire. Unlike activities there is no parent chapter/course to
    inherit from — the article is its own access root.

    ``accessible_restricted_uuids`` and ``is_admin`` let batch callers (e.g.
    list_articles) pass in results computed once for the whole page instead
    of triggering a fresh query per row.
    """
    is_anon = isinstance(current_user, AnonymousUser)
    acting_user_id = resolve_acting_user_id(current_user)
    admin = is_admin
    if admin is None:
        admin = False if is_anon else await is_org_admin(acting_user_id, article.org_id, db_session)
    if admin:
        return

    locked = await is_locked_for_user(
        article.lock_type,
        article.article_uuid,
        article.org_id,
        current_user,
        db_session,
        accessible_restricted_uuids=accessible_restricted_uuids,
        is_admin=admin,
    )

    if locked:
        # Deliberately public teaser surface — left untouched: name,
        # thumbnail_image, excerpt (this IS the preview), seo. `content` is
        # the gated body. `extra_metadata` is arbitrary author-set payload
        # with no defined public shape, so it's scrubbed alongside content
        # rather than assumed safe to leak to a stranger.
        article_read.content = {}
        article_read.extra_metadata = None
        article_read.is_locked = True


####################################################
# CRUD
####################################################


async def create_article(
    request: Request,
    article_object: ArticleCreate,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> ArticleRead:
    """
    Create a new standalone article.

    SECURITY NOTES:
    - Requires create permission on "articles" in the target org. Mirrors
      create_course's "<prefix>_x" placeholder convention: check_resource_access
      routes CREATE + a uuid ending in "_x" to the org admin/maintainer-or-role
      permission check (src/security/rbac/resource_access.py:_check_create_permission),
      then require_org_membership confirms the caller actually belongs to the
      org named in the request body (that role check alone does not pin the
      org, see _load_applicable_roles's None-target-org branch).
    - The caller becomes the CREATOR resourceauthor automatically, same as
      create_course.
    """
    org_id = article_object.org_id

    await check_resource_access(request, db_session, current_user, "article_x", AccessAction.CREATE)
    await require_org_membership(resolve_acting_user_id(current_user), org_id, db_session)

    base_slug = _slugify(article_object.slug or article_object.name)
    if not base_slug:
        # Name/slug made entirely of punctuation/whitespace — extremely
        # unlikely but avoid ending up with an empty, collision-magnet slug.
        base_slug = "article"

    if isinstance(current_user, APITokenUser):
        author_user_id = current_user.created_by_user_id
    else:
        author_user_id = current_user.id

    article: Optional[Article] = None
    attempts = 0
    while True:
        slug = await _unique_slug(org_id, base_slug, db_session)

        article = Article(**article_object.model_dump(exclude={"slug", "org_id"}))
        article.article_uuid = f"article_{uuid4()}"
        article.org_id = org_id
        article.slug = slug
        article.creation_date = str(datetime.now())
        article.update_date = str(datetime.now())

        resource_author = ResourceAuthor(
            resource_uuid=article.article_uuid,
            user_id=author_user_id,
            authorship=ResourceAuthorshipEnum.CREATOR,
            authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )

        try:
            db_session.add(article)
            await db_session.flush()
            db_session.add(resource_author)
            await db_session.commit()
            break
        except IntegrityError:
            # Lost the race on ix_article_org_slug (or article_uuid, though
            # that collision is astronomically unlikely) — roll back and try
            # the next suffix. _unique_slug's pre-check will now see whatever
            # row just won.
            await db_session.rollback()
            attempts += 1
            if attempts >= MAX_SLUG_COLLISION_RETRIES:
                raise HTTPException(
                    status_code=409,
                    detail="Could not allocate a unique slug for this article",
                )

    await db_session.refresh(article)

    authors_statement = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid == article.article_uuid)
        .order_by(ResourceAuthor.id.asc())  # type: ignore
    )
    author_results = (await db_session.execute(authors_statement)).all()
    authors = [
        AuthorWithRole(
            user=UserRead.model_validate(user),
            authorship=resource_author.authorship,
            authorship_status=resource_author.authorship_status,
            creation_date=resource_author.creation_date,
            update_date=resource_author.update_date,
        )
        for resource_author, user in author_results
    ]

    article_data = {key: getattr(article, key) for key in article.model_fields}
    return ArticleRead.model_validate({**article_data, "authors": authors})


async def get_article(
    request: Request,
    article_uuid_or_slug: str,
    org_id: Optional[int],
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> ArticleRead:
    """
    Resolve an article by either its "article_<uuid>" id or an org-scoped slug.

    An unpublished article is readable by its authors and org admins and
    404/403s for everyone else. That's entirely check_resource_access's job
    (has_published_field=True on the "articles" RBAC config) — no second
    published check here.
    """
    statement = (
        select(Article, User)
        .outerjoin(User, Article.last_modified_by_id == User.id)  # type: ignore
    )

    if article_uuid_or_slug.startswith("article_"):
        statement = statement.where(Article.article_uuid == article_uuid_or_slug)
    else:
        if org_id is None:
            raise HTTPException(
                status_code=400,
                detail="org_id is required to resolve an article by slug",
            )
        statement = statement.where(
            Article.org_id == org_id, Article.slug == article_uuid_or_slug
        )

    result = (await db_session.execute(statement)).first()

    if not result:
        raise HTTPException(status_code=404, detail="Article not found")

    article, last_modified_user = result

    # RBAC check — article is a primary resource and its own access root.
    await check_resource_access(
        request, db_session, current_user, article.article_uuid, AccessAction.READ
    )

    authors_statement = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid == article.article_uuid)
        .order_by(ResourceAuthor.id.asc())  # type: ignore
    )
    author_results = (await db_session.execute(authors_statement)).all()
    authors = [
        AuthorWithRole(
            user=UserRead.model_validate(user),
            authorship=resource_author.authorship,
            authorship_status=resource_author.authorship_status,
            creation_date=resource_author.creation_date,
            update_date=resource_author.update_date,
        )
        for resource_author, user in author_results
    ]

    article_read = ArticleRead.model_validate(article)
    article_read.authors = authors
    article_read.last_modified_by_username = (
        last_modified_user.username if last_modified_user else None
    )

    await _apply_article_lock(article_read, article, current_user, db_session)

    return article_read


async def list_articles(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
    *,
    page: int = 1,
    limit: int = 20,
    published_only: bool = True,
) -> List[ArticleRead]:
    """
    Catalog read for an org's articles.

    Locked articles still show up as teasers (name, thumbnail, excerpt) with
    is_locked=True and empty content, rather than being filtered out or
    causing a 403 — same "gate, don't hide" behavior as _apply_article_lock
    gives a single-article read.

    PERFORMANCE: access is resolved with exactly one admin check and one
    batch_accessible_restricted_uuids call for the whole page, then reused
    per row via is_locked_for_user's accessible_restricted_uuids/is_admin
    escape hatches. Do not replace this with a per-row is_org_admin /
    batch_accessible_restricted_uuids call — that reintroduces the N+1 this
    was written to avoid.
    """
    limit = min(limit, 100)
    offset = (page - 1) * limit

    statement = (
        select(Article, User)
        .outerjoin(User, Article.last_modified_by_id == User.id)  # type: ignore
        .where(Article.org_id == org_id)
    )
    if published_only:
        statement = statement.where(Article.published == True)  # noqa: E712

    statement = (
        statement.order_by(Article.creation_date.desc())
        .offset(offset)
        .limit(limit)
    )

    results = (await db_session.execute(statement)).all()
    if not results:
        return []

    is_anon = isinstance(current_user, AnonymousUser)
    acting_user_id = resolve_acting_user_id(current_user)

    admin = False if is_anon else await is_org_admin(acting_user_id, org_id, db_session)

    accessible: set = set()
    if not admin and not is_anon:
        all_uuids = [article.article_uuid for article, _ in results]
        accessible = await batch_accessible_restricted_uuids(
            acting_user_id, all_uuids, db_session
        )

    reads: List[ArticleRead] = []
    for article, last_modified_user in results:
        article_read = ArticleRead.model_validate(article)
        article_read.last_modified_by_username = (
            last_modified_user.username if last_modified_user else None
        )
        await _apply_article_lock(
            article_read,
            article,
            current_user,
            db_session,
            accessible_restricted_uuids=accessible,
            is_admin=admin,
        )
        reads.append(article_read)

    return reads


async def update_article(
    request: Request,
    article_uuid: str,
    article_object: ArticleUpdate,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> ArticleRead:
    statement = select(Article).where(Article.article_uuid == article_uuid)
    article = (await db_session.execute(statement)).scalars().first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await check_resource_access(
        request, db_session, current_user, article.article_uuid, AccessAction.UPDATE
    )

    update_data = article_object.model_dump(exclude_unset=True)

    # Snapshot the previous content before overwriting it, same rule as
    # activities: only when there's existing content worth preserving.
    if "content" in update_data and article.content:
        user_id = resolve_acting_user_id(current_user)
        await create_article_version(article, user_id, db_session)
        article.current_version = (article.current_version or 1) + 1
        article.last_modified_by_id = user_id

    # Re-validate slug uniqueness when slug changes. Normalize through the
    # same slugify rules as creation so a caller can't sneak in spaces/mixed
    # case that would collide with an existing normalized slug.
    if "slug" in update_data and update_data["slug"]:
        candidate = _slugify(update_data["slug"])
        if not candidate:
            raise HTTPException(status_code=400, detail="Invalid slug")
        if candidate != article.slug:
            update_data["slug"] = await _unique_slug(
                article.org_id, candidate, db_session, exclude_id=article.id
            )
        else:
            del update_data["slug"]

    for field, value in update_data.items():
        setattr(article, field, value)

    article.update_date = str(datetime.now())

    if "content" in update_data:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(article, "content")

    attempts = 0
    while True:
        db_session.add(article)
        try:
            await db_session.commit()
            break
        except IntegrityError:
            # Race on ix_article_org_slug: someone else grabbed the slug our
            # pre-check just cleared. Roll back and pick the next candidate.
            await db_session.rollback()
            attempts += 1
            if "slug" not in update_data or attempts >= MAX_SLUG_COLLISION_RETRIES:
                raise HTTPException(
                    status_code=409,
                    detail="Could not update article — slug conflict",
                )
            update_data["slug"] = await _unique_slug(
                article.org_id, candidate, db_session, exclude_id=article.id
            )
            article.slug = update_data["slug"]

    await db_session.refresh(article)

    return ArticleRead.model_validate(article)


async def delete_article(
    request: Request,
    article_uuid: str,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> dict:
    statement = select(Article).where(Article.article_uuid == article_uuid)
    article = (await db_session.execute(statement)).scalars().first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await check_resource_access(
        request, db_session, current_user, article.article_uuid, AccessAction.DELETE
    )

    # resourceauthor.resource_uuid is a bare string, not an FK — the
    # ondelete="CASCADE" on ArticleVersion/Block covers those, but authorship
    # rows for this article need an explicit delete or they'd orphan.
    authors_statement = select(ResourceAuthor).where(
        ResourceAuthor.resource_uuid == article.article_uuid
    )
    authors = (await db_session.execute(authors_statement)).scalars().all()
    for author in authors:
        await db_session.delete(author)

    await db_session.delete(article)
    await db_session.commit()

    return {"detail": "Article deleted"}
