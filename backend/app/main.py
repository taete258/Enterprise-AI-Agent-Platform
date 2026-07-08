from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import get_settings
from .db.session import engine, Base, SessionLocal
from .core.security import hash_password
from . import models  # noqa: F401  — register models
from .api import auth, agents, llm, sessions, knowledge, admin, mock, images

settings = get_settings()


def _init_db() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    # Create all tables from models
    Base.metadata.create_all(bind=engine)

    # Add missing columns using IF NOT EXISTS to avoid connection state issues
    _safe_migrations = [
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_calls TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_call_id VARCHAR(128)",
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE",
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE",
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
        "ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS supports_image_generation BOOLEAN DEFAULT FALSE",
        "ALTER TABLE roles ADD COLUMN IF NOT EXISTS description VARCHAR(512) DEFAULT ''",
    ]
    for sql in _safe_migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
        except Exception as e:
            print(f"Warning: migration skipped ({e})")

    # group_id has FK constraint so keep separate with warning
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES session_groups(id) ON DELETE SET NULL"))
            conn.commit()
    except Exception as e:
        print(f"Warning: Could not add group_id column: {e}")

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

        # Seed default roles
        from .core.permissions import DEFAULT_ROLES
        for role_name, role_data in DEFAULT_ROLES.items():
            if not db.query(models.Role).filter_by(name=role_name).first():
                role = models.Role(name=role_name, description=role_data["description"])
                role.permissions = role_data["permissions"]
                db.add(role)
        db.commit()

        # Seed image generation tool if missing
        if not db.query(models.Tool).filter_by(key="generate_image").first():
            db.add(models.Tool(
                name="Generate Image",
                key="generate_image",
                description="Generate an image from a text prompt. Returns a URL to the saved image stored in object storage.",
                type="system",
                url="openrouter",
                headers='{"model": "google/gemini-2.5-flash-image"}',
                schema_json='{"type": "object", "properties": {"prompt": {"type": "string", "description": "Detailed description of the image to generate"}, "size": {"type": "string", "description": "Image size: 1024x1024, 1024x1536, or 1536x1024"}}, "required": ["prompt"]}',
                is_system=True
            ))
            db.commit()
    finally:
        db.close()


def _init_storage() -> None:
    from .services import storage as storage_svc
    try:
        storage_svc.ensure_buckets()
    except Exception as e:
        print(f"Warning: MinIO ensure_buckets failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    _init_storage()
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
app.include_router(images.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
