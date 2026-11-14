"""User accounts."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.associations import user_groups, user_permissions
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.group import Group
    from app.models.permission import Permission


class User(TimestampMixin, Base):
    """A person who can log in. Accounts are created by someone with `users.create` - there is no self-signup."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    hashed_password: Mapped[str] = mapped_column(String(255), comment="Argon2 hash. Never the plain password.")

    is_superuser: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Bypasses ALL permission checks. Only the seeded admin has this."
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="False = disabled account that cannot log in. (No activation flow.)"
    )

    department_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("departments.id", use_alter=True, name="fk_users_department_id"),
        nullable=True,
        index=True,
        comment="Department the user belongs to.",
    )
    manager_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True, comment="Direct manager: first approver of this user's requests."
    )

    department: Mapped[Optional["Department"]] = relationship(
        back_populates="employees", foreign_keys=[department_id]
    )
    manager: Mapped[Optional["User"]] = relationship(
        remote_side="User.id", back_populates="direct_reports", foreign_keys=[manager_id]
    )
    direct_reports: Mapped[list["User"]] = relationship(back_populates="manager", foreign_keys=[manager_id])

    groups: Mapped[list["Group"]] = relationship(secondary=user_groups, back_populates="users", lazy="selectin")
    direct_permissions: Mapped[list["Permission"]] = relationship(secondary=user_permissions, lazy="selectin")
