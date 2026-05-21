from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import get_settings
from .db.session import engine, Base, SessionLocal
from .core.security import hash_password
from . import models  # noqa: F401  — register models
from .api import auth, agents, llm, sessions, knowledge, admin, mock

settings = get_settings()


def _init_db() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    # Create all tables from models
    Base.metadata.create_all(bind=engine)

    # Add missing columns to existing tables
    with engine.connect() as conn:
        # Messages table migrations
        try:
            conn.execute(text("ALTER TABLE messages ADD COLUMN tool_calls TEXT"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE messages ADD COLUMN tool_call_id VARCHAR(128)"))
            conn.commit()
        except Exception:
            pass

        # ChatSession table migrations
        try:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN group_id INTEGER REFERENCES session_groups(id) ON DELETE SET NULL"))
            conn.commit()
        except Exception as e:
            print(f"Warning: Could not add group_id column: {e}")
            pass

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
            
        # Seed default tools if none exist
        if not db.query(models.Tool).first():
            db.add(models.Tool(
                name="Calculator",
                key="calculator",
                description="Evaluate mathematical expressions. Useful for calculations.",
                type="system",
                schema_json='{"type": "object", "properties": {"expression": {"type": "string", "description": "The math expression to evaluate, e.g. 2 + 2"}}, "required": ["expression"]}',
                is_system=True
            ))
            db.add(models.Tool(
                name="Weather Forecast",
                key="weather",
                description="Get current weather conditions and temperature for a city.",
                type="api",
                url="/api/mock/weather",
                method="GET",
                schema_json='{"type": "object", "properties": {"city": {"type": "string", "description": "City name, e.g. Bangkok"}}, "required": ["city"]}',
                is_system=False
            ))
            db.add(models.Tool(
                name="HR Leave Balance",
                key="hr_leave_balance",
                description="Get the remaining annual leave balance for an employee.",
                type="api",
                url="/api/mock/hr/leaves",
                method="GET",
                schema_json='{"type": "object", "properties": {"email": {"type": "string", "description": "Employee company email"}}, "required": ["email"]}',
                is_system=False
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
app.include_router(mock.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
