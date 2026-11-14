"""SQLAlchemy engine and session management (MariaDB via PyMySQL)."""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

# pool_pre_ping drops dead connections (MariaDB closes idle ones after wait_timeout).
engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one database session per request, always closed afterwards.

    Services receive this session and are responsible for commit/rollback.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
