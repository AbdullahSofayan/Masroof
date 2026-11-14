"""Groups (a.k.a. roles): named bundles of permissions."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.associations import group_permissions, user_groups
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.permission import Permission
    from app.models.user import User


class Group(TimestampMixin, Base):
    """A reusable set of permissions, e.g. "Employee", "Manager", "Finance".

    Groups are plain data created through the API - nothing in the code depends on
    a group's name. (Code depends on *permissions*, never on group names.)
    """

    __tablename__ = "permission_groups"  # "groups" is a reserved word in some MySQL versions

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    permissions: Mapped[list["Permission"]] = relationship(secondary=group_permissions, lazy="selectin")
    users: Mapped[list["User"]] = relationship(secondary=user_groups, back_populates="groups")
