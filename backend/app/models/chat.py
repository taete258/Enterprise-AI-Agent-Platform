from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.session import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), default="New chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())

    messages: Mapped[list["Message"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="Message.id")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16))  # user | assistant | system | tool
    content: Mapped[str] = mapped_column(Text)
    # JSON-string for attachments (images, files)
    attachments: Mapped[str] = mapped_column(String, default="[]")
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())

    session: Mapped[ChatSession] = relationship(back_populates="messages")
    citations: Mapped[list["Citation"]] = relationship(back_populates="message", cascade="all, delete-orphan")


class Citation(Base):
    __tablename__ = "citations"
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    chunk_id: Mapped[int | None] = mapped_column(ForeignKey("document_chunks.id"), nullable=True)
    snippet: Mapped[str] = mapped_column(Text, default="")
    score: Mapped[float] = mapped_column(default=0.0)

    message: Mapped[Message] = relationship(back_populates="citations")
