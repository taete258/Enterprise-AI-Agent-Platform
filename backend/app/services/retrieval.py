from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import AgentKnowledge, DocumentChunk, Document
from .embeddings import embed_one


def retrieve(db: Session, *, agent_id: int, query: str, top_k: int = 4) -> list[tuple[DocumentChunk, float]]:
    bindings = db.scalars(select(AgentKnowledge.document_id).where(AgentKnowledge.agent_id == agent_id)).all()
    if not bindings:
        return []
    try:
        qvec = embed_one(db, query)
    except Exception:
        return []

    # pgvector cosine distance via SQLAlchemy: smaller is closer
    distance = DocumentChunk.embedding.cosine_distance(qvec).label("dist")
    rows = db.execute(
        select(DocumentChunk, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(DocumentChunk.document_id.in_(bindings), Document.is_active == True)
        .order_by(distance)
        .limit(top_k)
    ).all()
    # Convert distance → similarity score
    return [(chunk, max(0.0, 1.0 - float(d))) for chunk, d in rows]


def format_context(hits: list[tuple[DocumentChunk, float]]) -> str:
    if not hits:
        return ""
    lines = ["บริบทอ้างอิงจากเอกสาร (ใช้ประกอบคำตอบ และอ้างอิงด้วย [n]):"]
    for i, (chunk, score) in enumerate(hits, start=1):
        lines.append(f"[{i}] (doc#{chunk.document_id}) {chunk.text}")
    return "\n\n".join(lines)
