"""User shapes. Passwords are write-only: no response ever contains a password or hash."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.constants import MIN_PASSWORD_LENGTH
from app.schemas.group import GroupBrief
from app.schemas.permission import PermissionRead


class UserBrief(BaseModel):
    """Compact user reference, embedded in other responses (requester, approver, manager...)."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="User id.", examples=[12])
    username: str = Field(description="Login name.", examples=["sara.k"])
    full_name: str = Field(description="Display name.", examples=["Sara Khalid"])


class UserCreate(BaseModel):
    """Created by an administrator: there is no self-signup."""

    username: str = Field(min_length=3, max_length=50, description="Unique login name.", examples=["sara.k"])
    email: EmailStr = Field(description="Unique email. Notifications are sent here.", examples=["sara@company.com"])
    full_name: str = Field(min_length=2, max_length=120, description="Display name.", examples=["Sara Khalid"])
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, description="Initial password.")
    department_id: int | None = Field(default=None, description="Department the user belongs to.")
    manager_id: int | None = Field(default=None, description="The user's direct manager (first approver of their requests).")
    group_ids: list[int] = Field(default_factory=list, description="Groups to place the user in.")


class UserUpdate(BaseModel):
    """Partial update: send only the fields to change. Groups/permissions have their own routes."""

    email: EmailStr | None = Field(default=None, description="New email.")
    full_name: str | None = Field(default=None, min_length=2, max_length=120, description="New display name.")
    department_id: int | None = Field(default=None, description="New department.")
    manager_id: int | None = Field(default=None, description="New direct manager.")
    is_active: bool | None = Field(default=None, description="False disables the account (cannot log in).")


class UserRead(UserBrief):
    email: EmailStr = Field(description="Email address.")
    is_active: bool = Field(description="False = disabled account.")
    is_superuser: bool = Field(description="True only for the seeded admin.")
    department_id: int | None = Field(description="Department id, if any.")
    manager_id: int | None = Field(description="Direct manager's user id, if any.")
    groups: list[GroupBrief] = Field(description="Groups the user belongs to.")
    created_at: datetime = Field(description="When the account was created.")


class UserMe(UserRead):
    """The caller's own profile, including what they are allowed to do (handy for hiding UI)."""

    effective_permissions: list[str] = Field(
        description="Names of every permission the user holds (groups + direct grants). Superusers hold all."
    )


class UserResetPassword(BaseModel):
    """An administrator sets a new password for another user."""

    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, description="The new password.")


class UserGroupsUpdate(BaseModel):
    """Replaces the user's group memberships entirely."""

    group_ids: list[int] = Field(description="The COMPLETE list of group ids the user should belong to.")


class UserPermissionsUpdate(BaseModel):
    """Replaces the user's DIRECT permissions entirely (group permissions are unaffected)."""

    permission_ids: list[int] = Field(description="The COMPLETE list of permission ids granted directly to the user.")


class UserPermissionsRead(BaseModel):
    direct: list[PermissionRead] = Field(description="Permissions granted directly to the user.")
    effective: list[str] = Field(description="All permission names the user holds, from groups and direct grants.")
