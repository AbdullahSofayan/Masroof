"""User administration. There is no self-signup: accounts are created here by someone with `users.create`."""
from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.deps import CurrentUser, DbSession, Pagination
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.common import Message, Page
from app.schemas.user import (
    UserCreate,
    UserGroupsUpdate,
    UserMe,
    UserPermissionsRead,
    UserPermissionsUpdate,
    UserRead,
    UserResetPassword,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["Users"])

UserId = Annotated[int, Path(ge=1, description="ID of the user.")]
NOT_FOUND = {404: {"description": "User not found."}}


@router.get(
    "",
    response_model=Page[UserRead],
    summary="List users",
    **protected("users.list", "List and search users", details="Paginated. Supports free-text search and filters."),
)
def list_users(
    db: DbSession,
    page: Pagination,
    search: Annotated[str | None, Query(description="Matches username, full name or email.")] = None,
    department_id: Annotated[int | None, Query(description="Only users of this department.")] = None,
    is_active: Annotated[bool | None, Query(description="Filter by enabled/disabled accounts.")] = None,
):
    # Delegates to UserService.list_users(...)
    not_implemented()


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
    **protected(
        "users.create",
        "Create user accounts",
        details=(
            "Creates an account with its department, manager and groups. The username `admin` is reserved. "
            "A welcome email is sent to the new user."
        ),
        responses={409: {"description": "Username or email already in use."}},
    ),
)
def create_user(body: UserCreate, db: DbSession):
    # Delegates to UserService.create_user(...)
    not_implemented()


@router.get(
    "/me",
    response_model=UserMe,
    summary="Get my profile",
    **protected(
        "users.view_self",
        "View your own profile and permissions",
        details="Returns the caller's profile plus the list of permission names they hold.",
    ),
)
def get_me(current_user: CurrentUser, db: DbSession):
    # Delegates to RbacService.get_effective_permission_names(current_user)
    not_implemented()


@router.get(
    "/{user_id}",
    response_model=UserRead,
    summary="Get a user",
    **protected("users.view", "View any user", responses=NOT_FOUND),
)
def get_user(user_id: UserId, db: DbSession):
    # Delegates to UserService.get_user(...)
    not_implemented()


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    summary="Update a user",
    **protected(
        "users.update",
        "Edit users, including disabling accounts",
        details="Partial update. Set `is_active=false` to disable an account.",
        responses=NOT_FOUND,
    ),
)
def update_user(user_id: UserId, body: UserUpdate, db: DbSession):
    # Delegates to UserService.update_user(...)
    not_implemented()


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user",
    **protected(
        "users.delete",
        "Delete users",
        details="The superuser cannot be deleted. Users that already have expenses/approvals cannot be deleted - disable them instead.",
        responses={**NOT_FOUND, 409: {"description": "User is referenced by other records."}},
    ),
)
def delete_user(user_id: UserId, db: DbSession):
    # Delegates to UserService.delete_user(...)
    not_implemented()


@router.post(
    "/{user_id}/reset-password",
    response_model=Message,
    summary="Reset a user's password",
    **protected(
        "users.reset_password",
        "Set a new password for another user",
        details="Administrator action: sets the password directly (no email flow in the MVP).",
        responses=NOT_FOUND,
    ),
)
def reset_user_password(user_id: UserId, body: UserResetPassword, db: DbSession):
    # Delegates to UserService.reset_password(...)
    not_implemented()


@router.put(
    "/{user_id}/groups",
    response_model=UserRead,
    summary="Set a user's groups",
    **protected(
        "users.assign_groups",
        "Choose which groups a user belongs to",
        details="Replaces the user's group memberships with exactly the list sent.",
        responses=NOT_FOUND,
    ),
)
def set_user_groups(user_id: UserId, body: UserGroupsUpdate, db: DbSession):
    # Delegates to UserService.set_groups(...)
    not_implemented()


@router.get(
    "/{user_id}/permissions",
    response_model=UserPermissionsRead,
    summary="Get a user's permissions",
    **protected(
        "users.view_permissions",
        "See a user's direct and effective permissions",
        responses=NOT_FOUND,
    ),
)
def get_user_permissions(user_id: UserId, db: DbSession):
    # Delegates to RbacService.get_effective_permission_names(...)
    not_implemented()


@router.put(
    "/{user_id}/permissions",
    response_model=UserPermissionsRead,
    summary="Set a user's direct permissions",
    **protected(
        "users.assign_permissions",
        "Grant permissions directly to a user",
        details="Replaces the user's DIRECT permissions. Permissions coming from groups are not affected.",
        responses=NOT_FOUND,
    ),
)
def set_user_permissions(user_id: UserId, body: UserPermissionsUpdate, db: DbSession):
    # Delegates to UserService.set_direct_permissions(...)
    not_implemented()
