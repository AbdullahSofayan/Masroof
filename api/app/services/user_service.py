"""User administration."""
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_users(
        self, page: int, size: int, search: str | None, department_id: int | None, is_active: bool | None
    ) -> tuple[list[User], int]:
        """Return (users on this page, total matching). `search` matches username, full name or email."""
        raise NotImplementedError

    def get_user(self, user_id: int) -> User:
        """Return the user or raise NotFoundError(USER_NOT_FOUND)."""
        raise NotImplementedError

    def create_user(self, data: UserCreate) -> User:
        """Create an account.

        Rules: reject the reserved username (SUPERUSER_USERNAME); username and email must be
        unique (ConflictError); department/manager/groups must exist; hash the password;
        queue the WELCOME_NEW_USER email.
        """
        raise NotImplementedError

    def update_user(self, user_id: int, data: UserUpdate) -> User:
        """Partial update. A user cannot be their own manager. Disabling = `is_active=False`."""
        raise NotImplementedError

    def delete_user(self, user_id: int) -> None:
        """Delete a user. The superuser cannot be deleted.

        If the user is referenced by expenses/approvals, raise ConflictError(RESOURCE_IN_USE)
        and suggest disabling instead.
        """
        raise NotImplementedError

    def reset_password(self, user_id: int, new_password: str) -> None:
        """Set a new password for another user (administrator action)."""
        raise NotImplementedError

    def set_groups(self, user_id: int, group_ids: list[int]) -> User:
        """Replace the user's group memberships with exactly `group_ids`."""
        raise NotImplementedError

    def set_direct_permissions(self, user_id: int, permission_ids: list[int]) -> User:
        """Replace the user's direct permission grants with exactly `permission_ids`."""
        raise NotImplementedError
