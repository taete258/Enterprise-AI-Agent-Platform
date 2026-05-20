from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from ..db.session import Base


class Tool(Base):
    """A tool/skill that can be toggled and configured for an agent."""
    __tablename__ = "tools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(32), default="api")  # api | sql | system
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    method: Mapped[str | None] = mapped_column(String(16), nullable=True, default="GET")
    headers: Mapped[str] = mapped_column(Text, default="{}")  # JSON string for headers config
    schema_json: Mapped[str] = mapped_column(Text, default="{}")  # JSON Schema for parameters
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow()
    )
