"""Category shapes."""
from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80, description="Unique category name.", examples=["Food"])
    description: str | None = Field(default=None, max_length=255, description="What belongs in this category.")


class CategoryUpdate(BaseModel):
    """Partial update: send only the fields to change."""

    name: str | None = Field(default=None, min_length=2, max_length=80, description="New name.")
    description: str | None = Field(default=None, max_length=255, description="New description.")
    is_active: bool | None = Field(default=None, description="False hides it from new requests.")


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Category id.")
    name: str = Field(description="Category name.")
    description: str | None = Field(description="What belongs in this category.")
    is_active: bool = Field(description="Whether it can be chosen for new requests.")
