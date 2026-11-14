"""Company settings (single company: there is exactly one settings record)."""
from fastapi import APIRouter

from app.core.deps import DbSession
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.settings import SettingsRead, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "",
    response_model=SettingsRead,
    summary="Get company settings",
    **protected("settings.view", "View company settings"),
)
def get_settings_route(db: DbSession):
    # Reads the single CompanySettings row (id = 1)
    not_implemented()


@router.patch(
    "",
    response_model=SettingsRead,
    summary="Update company settings",
    **protected("settings.update", "Edit company settings (name, currency)"),
)
def update_settings_route(body: SettingsUpdate, db: DbSession):
    # Updates the single CompanySettings row (id = 1)
    not_implemented()
