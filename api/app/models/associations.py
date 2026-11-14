"""Many-to-many link tables for the RBAC system.

Effective permissions of a user =
    union of (permissions of every group the user belongs to)
    + (permissions granted directly to the user).
The superuser ignores all of this (see core/permissions.py).
"""
from sqlalchemy import Column, ForeignKey, Table

from app.models.base import Base

user_groups = Table(
    "user_groups",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", ForeignKey("permission_groups.id", ondelete="CASCADE"), primary_key=True),
)
"""Which groups a user belongs to."""

group_permissions = Table(
    "group_permissions",
    Base.metadata,
    Column("group_id", ForeignKey("permission_groups.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)
"""Which permissions a group grants."""

user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)
"""Permissions granted directly to a user, on top of their groups."""
