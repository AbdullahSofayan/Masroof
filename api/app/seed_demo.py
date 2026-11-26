"""Load the ML demo seed files into MySQL (ML contract, Part E).

Run it from the api folder:

    python -m app.seed_demo "C:\\Users\\you\\Downloads\\seed\\seed"
    python -m app.seed_demo <folder> --password "Another123!"

Rules from the contract (E4):
1. Keep the ids from the files. The AI model knows employees and departments by id.
2. Order: categories, departments (no manager yet), users, department managers,
   expense limits, budgets, expenses.
3. One demo password for every seeded user, hashed once.
4. Safe to run twice: a row whose id is already in the database is skipped.
"""
import argparse
import csv
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models.budget import Budget
from app.models.category import Category
from app.models.department import Department
from app.models.enums import ExpenseStatus, RiskLevel, UserRole
from app.models.expense import Expense
from app.models.expense_limit import ExpenseLimit
from app.models.user import User

DEFAULT_PASSWORD = "Masroof123!"
CHUNK_SIZE = 5000


# ---------- Reading the files ----------
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


# ---------- One converter per file ----------
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


# ---------- Saving ----------
def save_chunk(db: Session, model, chunk: list[dict]) -> int:
    if chunk:
        db.execute(insert(model), chunk)
        db.commit()
    return len(chunk)


def load(db: Session, model, rows, label: str) -> None:
    """Insert the rows whose id is not in the table yet, a few thousand at a time."""
    known = set(db.scalars(select(model.id)).all())
    added = skipped = 0
    chunk = []
    for row in rows:
        if row["id"] in known:
            skipped += 1
            continue
        chunk.append(row)
        if len(chunk) == CHUNK_SIZE:
            added += save_chunk(db, model, chunk)
            chunk = []
            print(f"  {label}: {added} so far...")
    added += save_chunk(db, model, chunk)
    print(f"{label}: {added} added, {skipped} already there")


def set_department_managers(db: Session, folder: Path) -> None:
    """Rule 2: give each department its manager, now that the managers exist."""
    count = 0
    for row in read_csv(folder, "departments.csv"):
        department = db.get(Department, int(row["id"]))
        manager_id = to_int(row["manager_id"])
        if department is not None and department.manager_id is None and manager_id is not None:
            department.manager_id = manager_id
            count += 1
    db.commit()
    print(f"Department managers: {count} set")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the ML demo seed files into MySQL.")
    parser.add_argument("folder", help="Folder that holds the 6 seed CSV files.")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Demo password for every seeded user.")
    args = parser.parse_args()
    folder = Path(args.folder)

    Base.metadata.create_all(bind=engine)
    password_hash = hash_password(args.password)  # rule 3: hash once, reuse for everyone

    with SessionLocal() as db:
        load(db, Category, (category_row(r) for r in read_csv(folder, "categories.csv")), "Categories")
        load(db, Department, (department_row(r) for r in read_csv(folder, "departments.csv")), "Departments")
        load(db, User, (user_row(r, password_hash) for r in read_csv(folder, "users.csv")), "Users")
        set_department_managers(db, folder)
        load(db, ExpenseLimit, (expense_limit_row(r) for r in read_csv(folder, "expense_limits.csv")), "Expense limits")
        load(db, Budget, (budget_row(r) for r in read_csv(folder, "budget.csv")), "Budgets")
        load(db, Expense, (expense_row(r) for r in read_csv(folder, "expenses.csv")), "Expenses")
    print("Done. Every seeded user can log in with the demo password.")


if __name__ == "__main__":
    main()