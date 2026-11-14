"""Department shapes."""
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserBrief


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120, description="Unique department name.", examples=["Engineering"])
    description: str | None = Field(default=None, max_length=255, description="What the department does.")
    manager_id: int | None = Field(default=None, description="User who manages the department.")


class DepartmentUpdate(BaseModel):
    """Partial update: send only the fields to change."""

    name: str | None = Field(default=None, min_length=2, max_length=120, description="New name.")
    description: str | None = Field(default=None, max_length=255, description="New description.")
    manager_id: int | None = Field(default=None, description="New manager.")


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Department id.")
    name: str = Field(description="Department name.")
    description: str | None = Field(description="What the department does.")
    manager: UserBrief | None = Field(description="The department's manager, if assigned.")
