"""Departments."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.budget import Budget
    from app.models.user import User


class Department(TimestampMixin, Base):
    """An organizational unit. Its manager is the first approver for its employees' requests."""

    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    manager_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", use_alter=True, name="fk_departments_manager_id"),
        nullable=True,
        comment="User who manages this department.",
    )

    # Two foreign keys link users <-> departments (users.department_id and
    # departments.manager_id), so each relationship must name the key it follows.
    manager: Mapped[Optional["User"]] = relationship(foreign_keys=[manager_id])
    employees: Mapped[list["User"]] = relationship(back_populates="department", foreign_keys="User.department_id")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="department", cascade="all, delete-orphan")
