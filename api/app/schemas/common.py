"""Shapes shared by many endpoints."""
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Paginated list envelope returned by every list endpoint."""

    items: list[T] = Field(description="The records on this page.")
    total: int = Field(description="Total records matching the filters, across all pages.", examples=[42])
    page: int = Field(description="Current page number (starts at 1).", examples=[1])
    size: int = Field(description="Page size that was requested.", examples=[20])


class Message(BaseModel):
    """Simple confirmation body."""

    detail: str = Field(description="Human-readable message.", examples=["Done."])
