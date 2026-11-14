"""Login, token refresh and own-password change."""
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import CurrentUser, DbSession
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.auth import ChangePasswordRequest, RefreshRequest, TokenResponse
from app.schemas.common import Message

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in",
    description=(
        "Exchange a username and password for an access token and a refresh token. "
        "Uses the OAuth2 *password* flow, so the **Authorize** button in this page works.\n\n"
        "**Public route** - no token required."
    ),
    responses={401: {"description": "Wrong username or password."}, 403: {"description": "Account is disabled."}},
)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    # Delegates to AuthService.authenticate(...) then AuthService.issue_tokens(...)
    not_implemented()


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh tokens",
    description=(
        "Exchange a valid refresh token for a new access + refresh token pair.\n\n"
        "**Public route** - the refresh token in the body is the credential."
    ),
    responses={401: {"description": "Refresh token invalid or expired."}},
)
def refresh_tokens(body: RefreshRequest, db: DbSession):
    # Delegates to AuthService.refresh(...)
    not_implemented()


@router.post(
    "/change-password",
    response_model=Message,
    summary="Change my password",
    **protected(
        "auth.change_password",
        "Change your own password",
        details="Changes the password of the logged-in user after verifying the current one.",
        responses={400: {"description": "Current password is incorrect."}},
    ),
)
def change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: DbSession):
    # Delegates to AuthService.change_password(...)
    not_implemented()
