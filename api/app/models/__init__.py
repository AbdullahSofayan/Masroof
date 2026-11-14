"""Importing this package registers EVERY model on `Base.metadata` (needed by Alembic)."""
from app.models.approval import Approval
from app.models.associations import group_permissions, user_groups, user_permissions
from app.models.attachment import Attachment
from app.models.base import Base
from app.models.budget import Budget
from app.models.category import Category
from app.models.department import Department
from app.models.expense import Expense
from app.models.group import Group
from app.models.permission import Permission
from app.models.policy import Policy
from app.models.settings import CompanySettings
from app.models.user import User

__all__ = [
    "Approval",
    "Attachment",
    "Base",
    "Budget",
    "Category",
    "CompanySettings",
    "Department",
    "Expense",
    "Group",
    "Permission",
    "Policy",
    "User",
    "group_permissions",
    "user_groups",
    "user_permissions",
]
