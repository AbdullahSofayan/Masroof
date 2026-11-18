from fastapi import FastAPI

from app.core.config import settings
from app.routes import auth, expenses, users

app = FastAPI(title=settings.app_name)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(expenses.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
