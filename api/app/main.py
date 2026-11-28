from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import Base, SessionLocal, engine
from app.routes import auth, expenses, users
from app.services.seed import seed_categories

# Importing the models package registers all ORM models before create_all.
import app.models  # noqa: F401

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_categories(db)

if settings.agent_enabled:
    from app.agent.router import router as agent_router
    from app.agent.sync import agent_lifespan
else:
    agent_router = None
    agent_lifespan = None

app = FastAPI(title=settings.app_name, lifespan=agent_lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(expenses.router)
if agent_router is not None:
    app.include_router(agent_router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
