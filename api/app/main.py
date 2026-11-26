from fastapi import FastAPI

from app.core.config import settings
from app.db.session import Base, SessionLocal, engine
from app.routes import auth, expenses, users
from app.services.seed import seed_categories

# Create db tables, and default categories
Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_categories(db)

app = FastAPI(title=settings.app_name)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(expenses.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
