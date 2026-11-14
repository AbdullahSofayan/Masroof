"""Password hashing, JWT handling and the "who is calling?" dependency.

Only definitions here - the team implements the bodies. Authentication is
OAuth2 password flow with JWT bearer tokens, which is what makes the
"Authorize" button in /docs work.
"""
from typing import Annotated, Any

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.constants import API_PREFIX
from app.core.database import get_db
from app.core.exceptions import not_implemented
from app.models.user import User

# Points Swagger UI at the login route so developers can log in from /docs.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{API_PREFIX}/auth/login",
    description="Log in with username + password; the returned access token is sent as `Authorization: Bearer <token>`.",
)


def hash_password(plain_password: str) -> str:
    """Return an Argon2 hash of the password. Never store or log the plain value."""
    not_implemented()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time check of a plain password against its stored hash."""
    not_implemented()


def create_access_token(user_id: int) -> str:
    """Create a short-lived JWT (type=access). Subject = user id. Lifetime: ACCESS_TOKEN_EXPIRE_MINUTES."""
    not_implemented()


def create_refresh_token(user_id: int) -> str:
    """Create a long-lived JWT (type=refresh). Lifetime: REFRESH_TOKEN_EXPIRE_DAYS."""
    not_implemented()


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    """Validate signature, expiry and `type` claim; return the payload. Raise UnauthorizedError otherwise."""
    not_implemented()


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Resolve the bearer token to a User.

    Must reject: bad/expired token, wrong token type (refresh used as access),
    unknown user, and disabled users (`is_active=False`).
    """
    not_implemented()
