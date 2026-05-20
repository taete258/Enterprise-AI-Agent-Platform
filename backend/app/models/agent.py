from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Boolean, Float, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.session import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(String(1024), default="")
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    model_id: Mapped[int] = mapped_column(ForeignKey("llm_models.id"))
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048)
    # Slider for "formality" / "creativity" presets — stored as JSON-string for flexibility
    style_config: Mapped[str] = mapped_column(String, default="{}")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    tools: Mapped[list["AgentTool"]] = relationship(back_populates="agent", cascade="all, delete-orphan")
    knowledge: Mapped[list["AgentKnowledge"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class AgentTool(Base):
    """Toggle a preset 'tool' (API preset) on an agent."""
    __tablename__ = "agent_tools"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    tool_key: Mapped[str] = mapped_column(String(128))  # e.g. "hr.leave_balance"
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[str] = mapped_column(String, default="{}")
    agent: Mapped[Agent] = relationship(back_populates="tools")


class AgentKnowledge(Base):
    """Bind a Document (or all docs in a Group) to an agent for RAG."""
    __tablename__ = "agent_knowledge"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    agent: Mapped[Agent] = relationship(back_populates="knowledge")
