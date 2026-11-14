"""Groups (roles): named sets of permissions that can be assigned to users."""
from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.deps import DbSession, Pagination
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.common import Page
from app.schemas.group import GroupCreate, GroupPermissionsUpdate, GroupRead, GroupUpdate

router = APIRouter(prefix="/groups", tags=["Groups"])

GroupId = Annotated[int, Path(ge=1, description="ID of the group.")]
NOT_FOUND = {404: {"description": "Group not found."}}


@router.get(
    "",
    response_model=Page[GroupRead],
    summary="List groups",
    **protected("groups.list", "List groups and their permissions"),
)
def list_groups(db: DbSession, page: Pagination):
    # Delegates to RbacService.list_groups(...)
    not_implemented()


@router.post(
    "",
    response_model=GroupRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a group",
    **protected(
        "groups.create",
        "Create groups",
        details="Creates a group and optionally grants it permissions by id (see `GET /permissions`).",
        responses={409: {"description": "A group with this name already exists."}},
    ),
)
def create_group(body: GroupCreate, db: DbSession):
    # Delegates to RbacService.create_group(...)
    not_implemented()


@router.get(
    "/{group_id}",
    response_model=GroupRead,
    summary="Get a group",
    **protected("groups.view", "View a group", responses=NOT_FOUND),
)
def get_group(group_id: GroupId, db: DbSession):
    # Delegates to RbacService.get_group(...)
    not_implemented()


@router.patch(
    "/{group_id}",
    response_model=GroupRead,
    summary="Update a group",
    **protected(
        "groups.update",
        "Rename or re-describe groups",
        details="Partial update of name/description. Use `PUT /groups/{id}/permissions` to change permissions.",
        responses=NOT_FOUND,
    ),
)
def update_group(group_id: GroupId, body: GroupUpdate, db: DbSession):
    # Delegates to RbacService.update_group(...)
    not_implemented()


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a group",
    **protected(
        "groups.delete",
        "Delete groups",
        details="Members of the group lose the permissions it granted.",
        responses=NOT_FOUND,
    ),
)
def delete_group(group_id: GroupId, db: DbSession):
    # Delegates to RbacService.delete_group(...)
    not_implemented()


@router.put(
    "/{group_id}/permissions",
    response_model=GroupRead,
    summary="Set a group's permissions",
    **protected(
        "groups.assign_permissions",
        "Choose which permissions a group grants",
        details="Replaces the group's permissions with exactly the ids sent.",
        responses=NOT_FOUND,
    ),
)
def set_group_permissions(group_id: GroupId, body: GroupPermissionsUpdate, db: DbSession):
    # Delegates to RbacService.set_group_permissions(...)
    not_implemented()
