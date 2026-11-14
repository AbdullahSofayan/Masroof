"""Environment-specific settings, loaded from environment variables / `.env`.

Access them through `get_settings()` (cached) so tests can override them easily.
Fixed, non-secret defaults live in `constants.py`, not here.
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="mysql+pymysql://expense:expense@localhost:3306/expense_db",
        description="SQLAlchemy URL for MariaDB (driver: PyMySQL).",
    )

    jwt_secret_key: str = Field(
        default="change-me-in-real-environments",
        description="Secret used to sign JWTs. MUST be overridden outside local development.",
    )

    superuser_email: str = Field(default="admin@example.com", description="Email of the seeded superuser.")
    superuser_password: str = Field(
        default="ChangeMe!123", description="Password of the seeded superuser (used by app/seed.py only)."
    )

    resend_api_key: str = Field(default="", description="Resend API key. Empty disables real sending.")
    email_from: str = Field(default="Expenses <no-reply@example.com>", description="Sender shown on emails.")
    email_enabled: bool = Field(
        default=False, description="False = EmailService logs messages instead of calling Resend."
    )

    upload_dir: str = Field(default="uploads", description="Local directory where attachments are stored.")

    ai_service_url: str = Field(
        default="",
        description="Base URL of your AI model service. Empty = use the built-in stub AI client.",
    )

    cors_origins: list[str] = Field(default_factory=list, description="Allowed front-end origins for CORS.")


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()
