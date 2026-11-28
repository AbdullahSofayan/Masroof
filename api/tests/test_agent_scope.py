from sqlalchemy import select

from app.agent.context import Scope, allowed_audiences, apply_scope, chroma_scope_filter
from app.models import Expense, UserRole


def test_employee_scope_is_own_expenses_only():
    scope = Scope(user_id=17, role=UserRole.EMPLOYEE, department_id=4)
    statement = apply_scope(select(Expense), scope)
    assert "EXPENSE.requester_id" in str(statement)
    assert "17" in str(statement)
    assert chroma_scope_filter(scope) == {"requester_id": 17}
    assert allowed_audiences(scope) == ["all"]


def test_manager_scope_is_department_only():
    scope = Scope(user_id=17, role=UserRole.MANAGER, department_id=4)
    statement = apply_scope(select(Expense), scope)
    assert "EXPENSE.department_id" in str(statement)
    assert "4" in str(statement)
    assert chroma_scope_filter(scope) == {"department_id": 4}
    assert allowed_audiences(scope) == ["all", "manager"]


def test_manager_without_department_sees_nothing():
    scope = Scope(user_id=17, role=UserRole.MANAGER, department_id=None)
    assert "false" in str(apply_scope(select(Expense), scope)).lower()


def test_finance_scope_is_global_but_knowledge_filtered_by_role():
    scope = Scope(user_id=1, role=UserRole.FINANCE_ADMIN, department_id=None)
    assert chroma_scope_filter(scope) is None
    assert allowed_audiences(scope) == ["all", "finance", "manager"]
