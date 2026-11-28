from contextlib import contextmanager
from dataclasses import dataclass

from sqlalchemy import Select

from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.models import Expense, User, UserRole


@dataclass(frozen=True)
class Scope:
    user_id: int
    role: UserRole
    department_id: int | None


def build_scope(user: User) -> Scope:
    return Scope(
        user_id=int(user.id),
        role=UserRole(user.role),
        department_id=user.department_id,
    )


def apply_scope(stmt: Select, scope: Scope) -> Select:
    """The authoritative SQL access boundary for every expense query."""
    if scope.role == UserRole.EMPLOYEE:
        return stmt.where(Expense.requester_id == scope.user_id)
    if scope.role == UserRole.MANAGER:
        if scope.department_id is None:
            return stmt.where(False)
        return stmt.where(Expense.department_id == scope.department_id)
    if scope.role == UserRole.FINANCE_ADMIN:
        return stmt
    return stmt.where(False)


def chroma_scope_filter(scope: Scope) -> dict | None:
    if scope.role == UserRole.EMPLOYEE:
        return {"requester_id": scope.user_id}
    if scope.role == UserRole.MANAGER:
        if scope.department_id is None:
            return {"department_id": -1}
        return {"department_id": scope.department_id}
    if scope.role == UserRole.FINANCE_ADMIN:
        return None
    return {"requester_id": -1}


def allowed_audiences(scope: Scope) -> list[str]:
    if scope.role == UserRole.FINANCE_ADMIN:
        return ["all", "finance", "manager"]
    if scope.role == UserRole.MANAGER:
        return ["all", "manager"]
    return ["all"]


@contextmanager
def agent_session():
    """Short-lived session independent of the request dependency."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def agent_database_url() -> str:
    return settings.agent_readonly_database_url or settings.database_url
