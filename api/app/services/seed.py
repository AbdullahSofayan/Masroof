from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Category

REQUIRED_CATEGORIES = (
    "Food", "Travel", "Transportation", "Office Supplies", "IT & Telecom", "Equipment & Maintenance",
)

def seed_categories(db: Session) -> None:
    """Insert the six ML-contract categories without renaming or duplicating existing rows."""
    existing = set(db.scalars(select(Category.name)).all())
    missing = [Category(name=name) for name in REQUIRED_CATEGORIES if name not in existing]
    if missing:
        db.add_all(missing)
        db.commit()
