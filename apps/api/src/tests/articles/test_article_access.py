"""Article access-matrix tests (standalone-articles Task 5).

The whole feature's value hangs on ONE property: a locked article never sends
its body. A test that only checks ``is_locked`` would stay green while content
leaks, so every row asserts BOTH ``is_locked`` AND ``content``.

Rows (from the plan, verbatim):

| lock_type     | caller             | is_locked | content | excerpt |
|---------------|--------------------|-----------|---------|---------|
| public        | anonymous          | False     | full    | present |
| public        | member             | False     | full    | present |
| authenticated | anonymous          | True      | {}      | present |
| authenticated | member             | False     | full    | present |
| restricted    | anonymous          | True      | {}      | present |
| restricted    | member not in group| True      | {}      | present |
| restricted    | member in group    | False     | full    | present |
| restricted    | org admin          | False     | full    | present |
"""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.articles import Article, ArticleLockType, ArticleRead
from src.services.articles.articles import get_article, list_articles

FULL_CONTENT = {"type": "doc", "content": [{"type": "paragraph", "content": []}]}


async def _mk_article(
    db,
    *,
    org_id: int,
    lock_type: ArticleLockType,
    published: bool = True,
    excerpt: str = "teaser body",
    uuid_suffix: str = "1234",
) -> Article:
    a = Article(
        name="Matrix Article",
        excerpt=excerpt,
        content=FULL_CONTENT,
        published=published,
        lock_type=lock_type,
        org_id=org_id,
        article_uuid=f"article_matrix_{uuid_suffix}",
        slug=f"matrix-{uuid_suffix}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


def _assert_matrix_row(article_read: ArticleRead, *, expected_locked: bool):
    """Assert BOTH the flag AND the actual content payload (the leak guard)."""
    assert article_read.is_locked is expected_locked
    if expected_locked:
        assert article_read.content == {}
    else:
        assert article_read.content == FULL_CONTENT
    # Excerpt is the only body text a locked caller ever receives.
    assert article_read.excerpt == "teaser body"


# ---------------------------------------------------------------------------
# Matrix implementation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_anonymous(db, org, anonymous_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, uuid_suffix="public_anon")
    read = await get_article(mock_request, a.article_uuid, None, anonymous_user, db)
    _assert_matrix_row(read, expected_locked=False)


@pytest.mark.asyncio
async def test_authenticated_anonymous(db, org, anonymous_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.AUTHENTICATED, uuid_suffix="auth_anon")
    read = await get_article(mock_request, a.article_uuid, None, anonymous_user, db)
    _assert_matrix_row(read, expected_locked=True)


@pytest.mark.asyncio
async def test_restricted_member_in_group(db, org, regular_user, mock_request):
    from src.db.usergroup_resources import UserGroupResource
    from src.db.usergroup_user import UserGroupUser
    from src.db.usergroups import UserGroup

    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.RESTRICTED, uuid_suffix="restr_insider")

    ug = UserGroup(
        name="Readers",
        description="",
        org_id=org.id,
        usergroup_uuid="usergroup_readers",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(ug)
    await db.commit()
    await db.refresh(ug)

    db.add(UserGroupResource(
        usergroup_id=ug.id,
        resource_uuid=a.article_uuid,
        org_id=org.id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    ))
    db.add(UserGroupUser(
        usergroup_id=ug.id,
        user_id=regular_user.id,
        org_id=org.id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    ))
    await db.commit()

    read = await get_article(mock_request, a.article_uuid, None, regular_user, db)
    _assert_matrix_row(read, expected_locked=False)


@pytest.mark.asyncio
async def test_restricted_org_admin(db, org, admin_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.RESTRICTED, uuid_suffix="restr_admin")
    read = await get_article(mock_request, a.article_uuid, None, admin_user, db)
    _assert_matrix_row(read, expected_locked=False)


@pytest.mark.asyncio
async def test_public_member(db, org, regular_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, uuid_suffix="public_member")
    read = await get_article(mock_request, a.article_uuid, None, regular_user, db)
    _assert_matrix_row(read, expected_locked=False)


@pytest.mark.asyncio
async def test_authenticated_member(db, org, regular_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.AUTHENTICATED, uuid_suffix="auth_member")
    read = await get_article(mock_request, a.article_uuid, None, regular_user, db)
    _assert_matrix_row(read, expected_locked=False)


@pytest.mark.asyncio
async def test_restricted_anonymous(db, org, anonymous_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.RESTRICTED, uuid_suffix="restr_anon")
    read = await get_article(mock_request, a.article_uuid, None, anonymous_user, db)
    _assert_matrix_row(read, expected_locked=True)


@pytest.mark.asyncio
async def test_restricted_member_not_in_group(db, org, regular_user, mock_request):
    a = await _mk_article(db, org_id=org.id, lock_type=ArticleLockType.RESTRICTED, uuid_suffix="restr_outsider")
    read = await get_article(mock_request, a.article_uuid, None, regular_user, db)
    _assert_matrix_row(read, expected_locked=True)


# ---------------------------------------------------------------------------
# Unpublished visibility (AC-2)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unpublished_invisible_to_anonymous(db, org, anonymous_user, mock_request):
    a = await _mk_article(
        db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, published=False, uuid_suffix="unpub_anon"
    )
    with pytest.raises(HTTPException) as exc:
        await get_article(mock_request, a.article_uuid, None, anonymous_user, db)
    assert exc.value.status_code in (403, 404)


@pytest.mark.asyncio
async def test_unpublished_invisible_to_non_author_member(db, org, regular_user, mock_request):
    a = await _mk_article(
        db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, published=False, uuid_suffix="unpub_member"
    )
    with pytest.raises(HTTPException) as exc:
        await get_article(mock_request, a.article_uuid, None, regular_user, db)
    assert exc.value.status_code in (403, 404)


@pytest.mark.asyncio
async def test_unpublished_readable_by_author(db, org, admin_user, mock_request):
    """The creator can read their own draft."""
    from src.db.resource_authors import (
        ResourceAuthor,
        ResourceAuthorshipEnum,
        ResourceAuthorshipStatusEnum,
    )

    a = await _mk_article(
        db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, published=False, uuid_suffix="unpub_author"
    )
    db.add(ResourceAuthor(
        resource_uuid=a.article_uuid,
        user_id=admin_user.id,
        authorship=ResourceAuthorshipEnum.CREATOR,
        authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    ))
    await db.commit()

    read = await get_article(mock_request, a.article_uuid, None, admin_user, db)
    assert read.is_locked is False
    assert read.content == FULL_CONTENT


@pytest.mark.asyncio
async def test_unpublished_readable_by_org_admin(db, org, admin_user, mock_request):
    a = await _mk_article(
        db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, published=False, uuid_suffix="unpub_admin"
    )
    read = await get_article(mock_request, a.article_uuid, None, admin_user, db)
    assert read.content == FULL_CONTENT


@pytest.mark.asyncio
async def test_unpublished_not_in_list_for_non_author(db, org, regular_user, mock_request):
    a = await _mk_article(
        db, org_id=org.id, lock_type=ArticleLockType.PUBLIC, published=False, uuid_suffix="unpub_list"
    )
    listing = await list_articles(
        mock_request, org.id, regular_user, db, published_only=True
    )
    uuids = [x.article_uuid for x in listing]
    assert a.article_uuid not in uuids
