"""Declarative base and shared column mixins for every table."""
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Parent of all ORM models. Alembic reads `Base.metadata` to generate migrations."""


class TimestampMixin:
    """Adds `created_at` / `updated_at`, both maintained by the database server."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="When the row was created."
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), comment="When the row was last modified."
    )
