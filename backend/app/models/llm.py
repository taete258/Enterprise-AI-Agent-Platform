from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Boolean, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.session import Base


class LLMProvider(Base):
    """A provider config (OpenAI, Anthropic, OpenRouter, Local). API key encrypted."""
    __tablename__ = "llm_providers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    kind: Mapped[str] = mapped_column(String(32))  # openai | anthropic | gemini | openrouter | local
    base_url: Mapped[str] = mapped_column(String(512), default="")
    api_key_encrypted: Mapped[str] = mapped_column(String, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())

    models: Mapped[list["LLMModel"]] = relationship(back_populates="provider", cascade="all, delete-orphan")


class LLMModel(Base):
    __tablename__ = "llm_models"
    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("llm_providers.id", ondelete="CASCADE"))
    model_id: Mapped[str] = mapped_column(String(128))  # e.g. "gpt-4o-mini"
    display_name: Mapped[str] = mapped_column(String(128), default="")
    context_window: Mapped[int] = mapped_column(Integer, default=8192)
    input_cost_per_1k: Mapped[float] = mapped_column(Float, default=0.0)
    output_cost_per_1k: Mapped[float] = mapped_column(Float, default=0.0)
    supports_vision: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    provider: Mapped[LLMProvider] = relationship(back_populates="models")
