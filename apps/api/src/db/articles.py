from typing import List, Optional
from sqlalchemy import JSON, Column, ForeignKey, Index, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel
from datetime import datetime
from enum import Enum

from src.db.courses.courses import AuthorWithRole


class ArticleLockType(str, Enum):
    """Mirrors ActivityLockType. Kept as its own enum so articles can evolve
    independently of the course tree."""
    PUBLIC = "public"                # anyone, including anonymous, can read
    AUTHENTICATED = "authenticated"  # must be signed in
    RESTRICTED = "restricted"        # only members of assigned usergroups


class ArticleBase(SQLModel):
    name: str
    # Shown to callers who cannot read the body. This is the ONLY body text a
    # locked caller ever receives, so `content` never needs server-side
    # truncation.
    excerpt: Optional[str] = Field(default=None)
    content: dict = Field(default_factory=dict, sa_column=Column(JSON))
    thumbnail_image: Optional[str] = Field(default="")
    published: bool = False
    lock_type: ArticleLockType = ArticleLockType.PUBLIC


class Article(ArticleBase, table=True):
    __table_args__ = (
        Index("ix_article_org_published_created", "org_id", "published", "creation_date"),
        Index("ix_article_org_slug", "org_id", "slug", unique=True),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    article_uuid: str = Field(default="", index=True)
    # URL-facing handle, unique per org. Reads accept either the slug or the uuid.
    slug: str = Field(default="")
    creation_date: str = ""
    update_date: str = ""
    seo: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    current_version: int = Field(default=1)
    last_modified_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"))
    )


class ArticleCreate(ArticleBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    slug: Optional[str] = None  # derived from `name` when omitted
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None


class ArticleUpdate(SQLModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[dict] = None
    thumbnail_image: Optional[str] = None
    published: Optional[bool] = None
    lock_type: Optional[ArticleLockType] = None
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None


class ArticleRead(ArticleBase):
    id: int
    org_id: int
    article_uuid: str
    slug: str
    creation_date: str
    update_date: str
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None
    authors: List[AuthorWithRole] = []
    current_version: int = 1
    last_modified_by_id: Optional[int] = None
    last_modified_by_username: Optional[str] = None
    # Computed per-request: true when the caller may not read `content`.
    # When true, `content` is `{}` and `excerpt` carries the preview.
    is_locked: bool = False


class ArticleVersion(SQLModel, table=True):
    """Historical article content. One row per save, capped like activities."""
    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(
        sa_column=Column(Integer, ForeignKey("article.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    content: dict = Field(default_factory=dict, sa_column=Column(JSON))
    version_number: int
    created_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"))
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow)
    )


class ArticleVersionRead(SQLModel):
    id: int
    article_id: int
    org_id: int
    content: dict
    version_number: int
    created_at: datetime
    created_by_username: Optional[str] = None
    created_by_avatar: Optional[str] = None


class ArticleStateRead(SQLModel):
    """Lightweight state read for editor conflict detection."""
    article_uuid: str
    update_date: str
    current_version: int
    last_modified_by_id: Optional[int] = None
    last_modified_by_username: Optional[str] = None
