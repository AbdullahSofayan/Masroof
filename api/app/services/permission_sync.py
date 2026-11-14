"""Keeps the `permissions` table in step with the permissions declared on routes."""
from sqlalchemy.orm import Session


class PermissionSyncService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def sync_permissions(self) -> None:
        """Upsert every entry of `PERMISSION_REGISTRY` into the `permissions` table. Run at startup.

        - New name        -> insert (the database generates the id).
        - Existing name   -> update the description if it changed, and set `is_stale=False`.
        - In DB, not in code -> set `is_stale=True`. NEVER delete: groups and users may still reference it.

        Must be called after all route modules are imported (that is what fills the registry).
        """
        raise NotImplementedError
