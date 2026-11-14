"""Login, token refresh and password change."""
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import TokenResponse


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def authenticate(self, username: str, password: str) -> User:
        """Verify credentials and return the user.

        Raise UnauthorizedError(INVALID_CREDENTIALS) for an unknown user OR a wrong password
        (same message for both, so usernames can't be probed) and ForbiddenError(ACCOUNT_DISABLED)
        when `is_active` is False.
        """
        raise NotImplementedError

    def issue_tokens(self, user: User) -> TokenResponse:
        """Create an access + refresh token pair for the user."""
        raise NotImplementedError

    def refresh(self, refresh_token: str) -> TokenResponse:
        """Validate a refresh token (type=refresh, not expired, user still active) and issue a new pair."""
        raise NotImplementedError

    def change_password(self, user: User, current_password: str, new_password: str) -> None:
        """Change the caller's own password after verifying `current_password`.

        Raise ConflictError/AppError(WRONG_CURRENT_PASSWORD) when verification fails.
        """
        raise NotImplementedError
