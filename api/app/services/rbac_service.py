"""Permission evaluation, visibility scope and group management."""
from sqlalchemy.orm import Session

from app.core.constants import ExpenseScope
from app.models.group import Group
from app.models.permission import Permission
from app.models.user import User
from app.schemas.group import GroupCreate, GroupUpdate


class RbacService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---- permission evaluation -------------------------------------------------

    def get_effective_permission_names(self, user: User) -> set[str]:
        """All permission names the user holds: union of their groups' permissions and direct grants.

        Superusers hold every registered permission.
        """
        raise NotImplementedError

    def user_has_permission(self, user: User, permission_name: str) -> bool:
        """True for superusers, or when the permission is among the user's effective permissions."""
        raise NotImplementedError

    def user_has_any_permission(self, user: User, permission_names: list[str]) -> bool:
        """True for superusers, or when the user holds at least one of the given permissions."""
        raise NotImplementedError

    def resolve_expense_scope(self, user: User) -> ExpenseScope:
        """Highest visibility the user has: ALL > DEPARTMENT > OWN.

        Uses EXPENSE_SCOPE_PERMISSIONS. Superusers get ALL. A user with none of the three
        cannot list expenses at all (the route's permission check already blocks them).
        """
        raise NotImplementedError

    # ---- permissions catalogue -------------------------------------------------

    def list_permissions(self, include_stale: bool) -> list[Permission]:
        """All known permissions, ordered by name. Stale ones only when requested."""
        raise NotImplementedError

    # ---- groups ----------------------------------------------------------------

    def list_groups(self, page: int, size: int) -> tuple[list[Group], int]:
        raise NotImplementedError

    def get_group(self, group_id: int) -> Group:
        """Return the group or raise NotFoundError."""
        raise NotImplementedError

    def create_group(self, data: GroupCreate) -> Group:
        """Name must be unique. All `permission_ids` must exist."""
        raise NotImplementedError

    def update_group(self, group_id: int, data: GroupUpdate) -> Group:
        raise NotImplementedError

    def delete_group(self, group_id: int) -> None:
        """Delete the group; members simply lose the permissions it granted."""
        raise NotImplementedError

    def set_group_permissions(self, group_id: int, permission_ids: list[int]) -> Group:
        """Replace the group's permission set with exactly `permission_ids`."""
        raise NotImplementedError
