"""Permission table. Rows are NOT created by hand: they are synced from the routes."""
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Permission(TimestampMixin, Base):
    """One action a user may be allowed to perform, e.g. `expenses.create`.

    The set of permissions is discovered from the routes at startup
    (`PermissionSyncService`). The generated `id` is what groups/users are
    assigned by through the API.
    """

    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, comment="Stable machine name, '<resource>.<action>'."
    )
    description: Mapped[str] = mapped_column(String(255), comment="Human description declared on the route.")
    is_stale: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="True when no route declares this permission anymore. Kept (not deleted) so existing assignments don't vanish silently.",
    )
