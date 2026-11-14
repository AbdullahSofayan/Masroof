"""Group (role) shapes."""
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.permission import PermissionRead


class GroupBrief(BaseModel):
    """Compact group reference, embedded inside user responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Group id.", examples=[2])
    name: str = Field(description="Group name.", examples=["Manager"])


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80, description="Unique group name.", examples=["Finance"])
    description: str | None = Field(default=None, max_length=255, description="What this group is for.")
    permission_ids: list[int] = Field(default_factory=list, description="Ids of permissions the group grants.")


class GroupUpdate(BaseModel):
    """Partial update: send only the fields to change. Use PUT /groups/{id}/permissions to change permissions."""

    name: str | None = Field(default=None, min_length=2, max_length=80, description="New group name.")
    description: str | None = Field(default=None, max_length=255, description="New description.")


class GroupRead(GroupBrief):
    description: str | None = Field(default=None, description="What this group is for.")
    permissions: list[PermissionRead] = Field(description="Permissions granted by this group.")


class GroupPermissionsUpdate(BaseModel):
    """Replaces the group's permission set entirely."""

    permission_ids: list[int] = Field(description="The COMPLETE list of permission ids the group should have.")
