"""User-facing passwordless magic-login token: shape, single-use, purpose."""

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from src.security.auth import decode_jwt
from src.services.auth import magic_login as ml
from src.services.auth.magic_login import (
    MAGIC_LOGIN_PURPOSE,
    consume_magic_login_token,
    issue_magic_login_token,
)
from src.services.auth.session import mint_session_tokens


class _FakeRedis:
    """Minimal SETNX-capable stand-in for the single-use marker store."""

    def __init__(self):
        self.store = {}

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True


@pytest.fixture
def fake_redis():
    r = _FakeRedis()
    with patch.object(ml, "_redis", return_value=r):
        yield r


class TestIssue:
    def test_token_shape(self):
        token = issue_magic_login_token("a@b.co", org_id=5)
        payload = decode_jwt(token)
        assert payload["purpose"] == MAGIC_LOGIN_PURPOSE
        assert payload["sub"] == "a@b.co"
        assert payload["org_id"] == 5
        assert payload.get("jti")

    def test_token_without_org(self):
        payload = decode_jwt(issue_magic_login_token("a@b.co", org_id=None))
        assert "org_id" not in payload


class TestConsume:
    def test_valid_token_returns_email_and_org(self, fake_redis):
        token = issue_magic_login_token("a@b.co", org_id=9)
        assert consume_magic_login_token(token) == ("a@b.co", 9)

    def test_single_use(self, fake_redis):
        token = issue_magic_login_token("a@b.co", org_id=None)
        assert consume_magic_login_token(token) == ("a@b.co", None)
        with pytest.raises(HTTPException) as exc:
            consume_magic_login_token(token)
        assert exc.value.status_code == 410
        assert exc.value.detail["code"] == "MAGIC_LINK_USED"

    def test_wrong_purpose_rejected(self, fake_redis):
        # A real session token must never be spendable as a login link.
        session = mint_session_tokens("a@b.co", amr="password", org_id=1)
        with pytest.raises(HTTPException) as exc:
            consume_magic_login_token(session.access_token)
        assert exc.value.status_code == 410
        assert exc.value.detail["code"] == "MAGIC_LINK_INVALID"

    def test_garbage_token_rejected(self, fake_redis):
        # decode_jwt returns None (not a raise) for an unparseable token, so this
        # lands on the wrong-purpose branch.
        with pytest.raises(HTTPException) as exc:
            consume_magic_login_token("not-a-jwt")
        assert exc.value.status_code == 410
        assert exc.value.detail["code"] == "MAGIC_LINK_INVALID"

    def test_fails_closed_without_redis(self):
        # If the single-use store is unavailable the link must be refused, not
        # allowed to replay.
        token = issue_magic_login_token("a@b.co", org_id=None)
        with patch.object(ml, "_redis", return_value=None):
            with pytest.raises(HTTPException) as exc:
                consume_magic_login_token(token)
        assert exc.value.status_code == 410
        assert exc.value.detail["code"] == "MAGIC_LINK_USED"
