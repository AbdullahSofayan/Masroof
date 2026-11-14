"""Permission shapes."""
from pydantic import BaseModel, ConfigDict, Field


class PermissionRead(BaseModel):
    """A permission discovered from the routes. Read-only: permissions are never created through the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Generated id. Use this when assigning the permission to a group or user.", examples=[7])
    name: str = Field(description="Machine name declared on the route.", examples=["expenses.create"])
    description: str = Field(description="What the permission allows.", examples=["Submit a new expense request"])
    is_stale: bool = Field(
        description="True if no route declares this permission anymore (kept so old assignments aren't lost)."
    )
