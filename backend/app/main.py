from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import get_settings
from .db.session import engine, Base, SessionLocal
from .core.security import hash_password
from . import models  # noqa: F401  — register models
from .api import auth, agents, llm, sessions, knowledge, admin

settings = get_settings()


def _init_db() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    # Seed first superuser if none exists
    db = SessionLocal()
    try:
        if not db.query(models.User).first():
            db.add(models.User(
                email="admin@example.com",
                full_name="Initial Admin",
                password_hash=hash_password("admin123"),
                is_active=True,
                is_superuser=True,
            ))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    yield


app = FastAPI(title="Enterprise AI Agent Platform", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(llm.router)
app.include_router(agents.router)
app.include_router(sessions.router)
app.include_router(knowledge.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
