"""Reusable FastAPI dependency aliases, so route signatures stay short and uniform.

    def my_route(db: DbSession, current_user: CurrentUser, page: Pagination): ...
"""
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

DbSession = Annotated[Session, Depends(get_db)]
"""A database session scoped to the current request."""

CurrentUser = Annotated[User, Depends(get_current_user)]
"""The authenticated user making the request (401 if not logged in)."""


class PageParams:
    """Standard `?page=&size=` query parameters shared by every list endpoint."""

    def __init__(
        self,
        page: Annotated[int, Query(ge=1, description="Page number, starting at 1.")] = 1,
        size: Annotated[
            int, Query(ge=1, le=MAX_PAGE_SIZE, description="Items per page.")
        ] = DEFAULT_PAGE_SIZE,
    ) -> None:
        self.page = page
        self.size = size


Pagination = Annotated[PageParams, Depends()]
