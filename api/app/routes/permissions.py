"""Read-only catalogue of every permission the system knows."""
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import DbSession
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.permission import PermissionRead

router = APIRouter(prefix="/permissions", tags=["Permissions"])


@router.get(
    "",
    response_model=list[PermissionRead],
    summary="List all permissions",
    **protected(
        "permissions.list",
        "List every permission in the system",
        details=(
            "Permissions are declared on the routes themselves and synced into the database at startup, "
            "so this list is always complete and never edited by hand. Use the returned `id`s when assigning "
            "permissions to groups or users."
        ),
    ),
)
def list_permissions(
    db: DbSession,
    include_stale: Annotated[
        bool, Query(description="Also return permissions no route declares anymore.")
    ] = False,
):
    # Delegates to RbacService.list_permissions(...)
    not_implemented()
