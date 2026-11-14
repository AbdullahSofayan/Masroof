"""Expense categories."""
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_categories(self, include_inactive: bool) -> list[Category]:
        """Not paginated: the list is short and clients need all of it for dropdowns."""
        raise NotImplementedError

    def get_category(self, category_id: int) -> Category:
        raise NotImplementedError

    def create_category(self, data: CategoryCreate) -> Category:
        """Name must be unique."""
        raise NotImplementedError

    def update_category(self, category_id: int, data: CategoryUpdate) -> Category:
        raise NotImplementedError

    def delete_category(self, category_id: int) -> None:
        """Raise ConflictError(RESOURCE_IN_USE) if expenses use it (deactivate instead)."""
        raise NotImplementedError
