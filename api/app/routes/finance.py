"""Finance API: departments, category spending limits, and monthly budgets.

Only finance admins can change budgets and limits.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.department import Department
from app.models.enums import ExpenseStatus, UserRole
from app.models.expense import Expense
from app.models.expense_limit import ExpenseLimit
from app.models.user import User
from app.schemas.finance import (
    BudgetCreate,
    BudgetRead,
    BudgetUpdate,
    BudgetUsageRead,
    DepartmentRead,
    ExpenseLimitCreate,
    ExpenseLimitRead,
    ExpenseLimitUpdate,
)
from app.services.finance_service import budget_usage

router = APIRouter(tags=["Finance"])
_finance = require_roles(UserRole.FINANCE_ADMIN)


def approved_spent(db: Session, department_id: int, year: int, month: int) -> Decimal:
    """Total of approved expenses for one department in one month."""
    total = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.department_id == department_id,
            Expense.status == ExpenseStatus.APPROVED,
            extract("year", Expense.expense_date) == year,
            extract("month", Expense.expense_date) == month,
        )
    )
    return Decimal(total)


# ---------- Departments ----------
@router.get("/departments", response_model=list[DepartmentRead])
def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(Department).order_by(Department.name)).all())


# ---------- Monthly budgets ----------
@router.get("/budgets", response_model=list[BudgetRead])
def list_budgets(
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(_finance),
):
    query = select(Budget).order_by(Budget.year, Budget.month, Budget.department_id)
    if year is not None:
        query = query.where(Budget.year == year)
    if month is not None:
        query = query.where(Budget.month == month)
    return list(db.scalars(query).all())


@router.post("/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, db: Session = Depends(get_db), _: User = Depends(_finance)):
    if db.get(Department, payload.department_id) is None:
        raise HTTPException(status_code=404, detail="Department not found")
    duplicate = db.scalar(
        select(Budget).where(
            Budget.department_id == payload.department_id,
            Budget.year == payload.year,
            Budget.month == payload.month,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="This department already has a budget for that month")
    budget = Budget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.patch("/budgets/{budget_id}", response_model=BudgetRead)
def update_budget(
    budget_id: int, payload: BudgetUpdate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: Session = Depends(get_db), _: User = Depends(_finance)):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/budgets/{budget_id}/usage", response_model=BudgetUsageRead)
def get_budget_usage(budget_id: int, db: Session = Depends(get_db), _: User = Depends(_finance)):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    spent = approved_spent(db, budget.department_id, budget.year, budget.month)
    return budget_usage(spent, budget.amount)


# ---------- Category spending limits ----------
@router.get("/expense-limits", response_model=list[ExpenseLimitRead])
def list_expense_limits(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(ExpenseLimit).order_by(ExpenseLimit.category_id)).all())


@router.post("/expense-limits", response_model=ExpenseLimitRead, status_code=status.HTTP_201_CREATED)
def create_expense_limit(
    payload: ExpenseLimitCreate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    if db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=404, detail="Category not found")
    duplicate = db.scalar(select(ExpenseLimit).where(ExpenseLimit.category_id == payload.category_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="This category already has a limit. Edit it instead")
    limit = ExpenseLimit(**payload.model_dump())
    db.add(limit)
    db.commit()
    db.refresh(limit)
    return limit


@router.patch("/expense-limits/{limit_id}", response_model=ExpenseLimitRead)
def update_expense_limit(
    limit_id: int, payload: ExpenseLimitUpdate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    limit = db.get(ExpenseLimit, limit_id)
    if limit is None:
        raise HTTPException(status_code=404, detail="Expense limit not found")
    limit.max_amount = payload.max_amount
    db.commit()
    db.refresh(limit)
    return limit


@router.delete("/expense-limits/{limit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_limit(limit_id: int, db: Session = Depends(get_db), _: User = Depends(_finance)):
    limit = db.get(ExpenseLimit, limit_id)
    if limit is None:
        raise HTTPException(status_code=404, detail="Expense limit not found")
    db.delete(limit)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)