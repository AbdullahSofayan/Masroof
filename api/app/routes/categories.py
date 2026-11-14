"""Expense categories."""
from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.deps import DbSession
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])

CategoryId = Annotated[int, Path(ge=1, description="ID of the category.")]
NOT_FOUND = {404: {"description": "Category not found."}}


@router.get(
    "",
    response_model=list[CategoryRead],
    summary="List categories",
    **protected(
        "categories.list",
        "List expense categories",
        details="Not paginated - the list is short and clients use it to fill dropdowns.",
    ),
)
def list_categories(
    db: DbSession,
    include_inactive: Annotated[bool, Query(description="Also return deactivated categories.")] = False,
):
    # Delegates to CategoryService.list_categories(...)
    not_implemented()


@router.post(
    "",
    response_model=CategoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a category",
    **protected(
        "categories.create",
        "Create expense categories",
        responses={409: {"description": "A category with this name already exists."}},
    ),
)
def create_category(body: CategoryCreate, db: DbSession):
    # Delegates to CategoryService.create_category(...)
    not_implemented()


@router.get(
    "/{category_id}",
    response_model=CategoryRead,
    summary="Get a category",
    **protected("categories.view", "View a category", responses=NOT_FOUND),
)
def get_category(category_id: CategoryId, db: DbSession):
    # Delegates to CategoryService.get_category(...)
    not_implemented()


@router.patch(
    "/{category_id}",
    response_model=CategoryRead,
    summary="Update a category",
    **protected(
        "categories.update",
        "Edit or deactivate categories",
        details="Set `is_active=false` to stop new requests using the category without losing history.",
        responses=NOT_FOUND,
    ),
)
def update_category(category_id: CategoryId, body: CategoryUpdate, db: DbSession):
    # Delegates to CategoryService.update_category(...)
    not_implemented()


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a category",
    **protected(
        "categories.delete",
        "Delete categories",
        responses={**NOT_FOUND, 409: {"description": "Category is used by expenses; deactivate it instead."}},
    ),
)
def delete_category(category_id: CategoryId, db: DbSession):
    # Delegates to CategoryService.delete_category(...)
    not_implemented()
