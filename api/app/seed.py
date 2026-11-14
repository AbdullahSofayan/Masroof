"""Initial data. Run once after the first migration:  python -m app.seed

Must be idempotent (safe to run repeatedly): check before inserting.
"""
from sqlalchemy.orm import Session


def seed_permissions(db: Session) -> None:
    """Run PermissionSyncService so the permission rows exist before anything references them."""
    raise NotImplementedError


def seed_superuser(db: Session) -> None:
    """Create the `admin` user (SUPERUSER_USERNAME) with is_superuser=True.

    Email and password come from settings (SUPERUSER_EMAIL / SUPERUSER_PASSWORD). Skip if it exists.
    """
    raise NotImplementedError


def seed_categories(db: Session) -> None:
    """Insert DEFAULT_CATEGORIES that don't exist yet."""
    raise NotImplementedError


def seed_company_settings(db: Session) -> None:
    """Create the single CompanySettings row (id=1) with the default name and currency if missing."""
    raise NotImplementedError


def run() -> None:
    """Open a session and call every seed function in order:
    permissions -> superuser -> categories -> company settings."""
    raise NotImplementedError


if __name__ == "__main__":
    run()
