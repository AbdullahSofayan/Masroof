"""Seed data: the 6 categories, and the ML demo data when its files are present.

The demo files come from ML (contract Part E) and are not in git. Put the 6 CSV files in
api/seed_data/ and they are loaded when the API starts. Without the folder, the API starts
normally with only the categories.

Rules from the contract (E4):
1. Keep the ids from the files. The AI model knows employees and departments by id.
2. Order: categories, departments (no manager yet), users, department managers,
   expense limits, budgets, expenses.
3. One demo password for every seeded user, hashed once.
4. Safe to run again: a row whose id is already in the database is skipped.
"""
import csv
import json
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.budget import Budget
from app.models.category import Category
from app.models.department import Department
from app.models.enums import ExpenseStatus, RiskLevel, UserRole
from app.models.expense import Expense
from app.models.expense_limit import ExpenseLimit
from app.models.user import User

REQUIRED_CATEGORIES = (
    "Food",
    "Travel",
    "Transportation",
    "Office Supplies",
    "IT & Telecom",
    "Equipment & Maintenance",
)

DEMO_FOLDER = Path(__file__).resolve().parents[2] / "seed_data"
DEMO_PASSWORD = "Masroof123!"
DEMO_FILES = (
    "categories.csv",
    "departments.csv",
    "users.csv",
    "expense_limits.csv",
    "budget.csv",
    "expenses.csv",
)
CHUNK_SIZE = 5000


def seed_categories(db: Session) -> None:
    """Insert the six ML-contract categories without renaming or duplicating existing rows."""
    existing = set(db.scalars(select(Category.name)).all())
    missing = [
        Category(name=name) for name in REQUIRED_CATEGORIES if name not in existing
    ]
    if missing:
        db.add_all(missing)
        db.commit()


# ---------- Demo data: reading the files ----------
def read_csv(folder: Path, file_name: str):
    """Yield each row of a seed file as a dict. Empty cells become None."""
    with open(folder / file_name, newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            yield {key: (value if value != "" else None) for key, value in row.items()}


def to_int(value):
    return int(value) if value is not None else None


def to_datetime(value):
    return datetime.fromisoformat(value) if value is not None else None


def to_json(value):
    return json.loads(value) if value is not None else None


@lru_cache
def demo_password_hash(password: str) -> str:
    """Rule 3: hash the demo password once and reuse it for every seeded user."""
    return hash_password(password)


# ---------- Demo data: one converter per file ----------
def category_row(row: dict) -> dict:
    return {"id": int(row["id"]), "name": row["name"]}


def department_row(row: dict) -> dict:
    # The manager is set later, once the users exist (rule 2).
    return {"id": int(row["id"]), "name": row["name"], "manager_id": None}


def user_row(row: dict, password_hash: str) -> dict:
    return {
        "id": int(row["id"]),
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "password_hash": password_hash,
        "role": UserRole(row["role"]),
        "department_id": to_int(row["department_id"]),
    }


def expense_limit_row(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "category_id": int(row["category_id"]),
        "max_amount": Decimal(row["max_amount"]),
    }


def budget_row(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "department_id": int(row["department_id"]),
        "year": int(row["year"]),
        "month": int(row["month"]),
        "amount": Decimal(row["amount"]),
    }


def expense_row(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "requester_id": int(row["requester_id"]),
        "department_id": int(row["department_id"]),
        "category_id": int(row["category_id"]),
        "amount": Decimal(row["amount"]),
        "description": row["description"] or "",
        "expense_date": date.fromisoformat(row["expense_date"]),
        "status": ExpenseStatus(row["status"]),
        "reviewed_by": to_int(row["reviewed_by"]),
        "reviewed_at": to_datetime(row["reviewed_at"]),
        "manager_note": row["manager_note"],
        "receipt_path": row["receipt_path"],
        "warnings": to_json(row["warnings"]) or [],
        "created_at": to_datetime(row["created_at"]) or datetime.now(),
        "updated_at": to_datetime(row["updated_at"]) or datetime.now(),
        "anomaly_score": float(row["anomaly_score"]) if row["anomaly_score"] is not None else None,
        "risk_level": RiskLevel(row["risk_level"]) if row["risk_level"] is not None else None,
        "risk_justification": to_json(row["risk_justification"]),
    }


# ---------- Demo data: saving ----------
def save_chunk(db: Session, model, chunk: list[dict]) -> int:
    if chunk:
        db.execute(insert(model), chunk)
        db.commit()
    return len(chunk)


def load(db: Session, model, folder: Path, file_name: str, convert, label: str) -> int:
    """Insert the rows whose id is not in the table yet, a few thousand at a time.

    The id is checked before the row is converted, so a second start is quick.
    """
    known = set(db.scalars(select(model.id)).all())
    added = 0
    chunk = []
    for row in read_csv(folder, file_name):
        if int(row["id"]) in known:
            continue
        chunk.append(convert(row))
        if len(chunk) == CHUNK_SIZE:
            added += save_chunk(db, model, chunk)
            chunk = []
            print(f"  {label}: {added} so far...")
    added += save_chunk(db, model, chunk)
    if added:
        print(f"{label}: {added} added")
    return added


def set_department_managers(db: Session, folder: Path) -> int:
    """Rule 2: give each department its manager, now that the managers exist."""
    count = 0
    for row in read_csv(folder, "departments.csv"):
        department = db.get(Department, int(row["id"]))
        manager_id = to_int(row["manager_id"])
        if department is not None and department.manager_id is None and manager_id is not None:
            department.manager_id = manager_id
            count += 1
    db.commit()
    if count:
        print(f"Department managers: {count} set")
    return count


def seed_demo_data(db: Session, folder: Path = DEMO_FOLDER, password: str = DEMO_PASSWORD) -> None:
    """Load the ML demo files from `folder`. Skips quietly when the folder or a file is missing."""
    if not folder.is_dir():
        print(f"Demo data: skipped, no folder at {folder}")
        return
    missing = [name for name in DEMO_FILES if not (folder / name).exists()]
    if missing:
        print(f"Demo data: skipped, missing {', '.join(missing)}")
        return

    def seeded_user(row: dict) -> dict:
        return user_row(row, demo_password_hash(password))

    added = 0
    added += load(db, Category, folder, "categories.csv", category_row, "Categories")
    added += load(db, Department, folder, "departments.csv", department_row, "Departments")
    added += load(db, User, folder, "users.csv", seeded_user, "Users")
    added += set_department_managers(db, folder)
    added += load(db, ExpenseLimit, folder, "expense_limits.csv", expense_limit_row, "Expense limits")
    added += load(db, Budget, folder, "budget.csv", budget_row, "Budgets")
    added += load(db, Expense, folder, "expenses.csv", expense_row, "Expenses")
    print("Demo data: loaded" if added else "Demo data: already loaded")