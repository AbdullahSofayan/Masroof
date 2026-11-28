from fastapi import FastAPI

from app.core.config import settings
from app.db.session import Base, SessionLocal, engine
from app.routes import auth, expenses, finance, users
from app.services.seed import seed_categories, seed_demo_data

# Create db tables, the default categories, and the ML demo data (when api/seed_data/ has the files)
Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_categories(db)
    seed_demo_data(db)

app = FastAPI(title=settings.app_name)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(expenses.router)
app.include_router(finance.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}