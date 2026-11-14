"""Authentication request/response shapes."""
from pydantic import BaseModel, Field

from app.core.constants import MIN_PASSWORD_LENGTH


class TokenResponse(BaseModel):
    """Returned by login and refresh."""

    access_token: str = Field(description="Short-lived JWT. Send as `Authorization: Bearer <token>`.")
    refresh_token: str = Field(description="Long-lived JWT. Exchange it at /auth/refresh for a new access token.")
    token_type: str = Field(default="bearer", description="Always `bearer`.")
    expires_in: int = Field(description="Access token lifetime in seconds.", examples=[1800])


class RefreshRequest(BaseModel):
    refresh_token: str = Field(description="A valid, unexpired refresh token.")


class ChangePasswordRequest(BaseModel):
    """The logged-in user changes their own password."""

    current_password: str = Field(description="The user's present password (verified before changing).")
    new_password: str = Field(
        min_length=MIN_PASSWORD_LENGTH,
        description=f"The new password (at least {MIN_PASSWORD_LENGTH} characters).",
    )
