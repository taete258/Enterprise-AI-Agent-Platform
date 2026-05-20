from sqlalchemy import String, ForeignKey, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from ..db.session import Base


class GraphEntity(Base):
    __tablename__ = "graph_entities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(256), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), default="Concept")
    description: Mapped[str] = mapped_column(Text, default="")
    # 1536-dim vector for semantic entity linking
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)


class GraphRelationship(Base):
    __tablename__ = "graph_relationships"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("graph_entities.id", ondelete="CASCADE"), index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("graph_entities.id", ondelete="CASCADE"), index=True)
    relation_type: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    # Associate to the document for filtering/scoping
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)

    source: Mapped[GraphEntity] = relationship("GraphEntity", foreign_keys=[source_id])
    target: Mapped[GraphEntity] = relationship("GraphEntity", foreign_keys=[target_id])


class ChunkEntityAssociation(Base):
    __tablename__ = "chunk_entity_associations"
    id: Mapped[int] = mapped_column(primary_key=True)
    chunk_id: Mapped[int] = mapped_column(ForeignKey("document_chunks.id", ondelete="CASCADE"), index=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("graph_entities.id", ondelete="CASCADE"), index=True)

    entity: Mapped[GraphEntity] = relationship("GraphEntity")
