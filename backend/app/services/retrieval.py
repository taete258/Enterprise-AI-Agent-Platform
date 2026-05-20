from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import AgentKnowledge, DocumentChunk, Document, ChunkEntityAssociation, GraphEntity, GraphRelationship
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


def format_context(db: Session, hits: list[tuple[DocumentChunk, float]], agent_id: int) -> str:
    if not hits:
        return ""
    lines = ["บริบทอ้างอิงจากเอกสาร (ใช้ประกอบคำตอบ และอ้างอิงด้วย [n]):"]
    for i, (chunk, score) in enumerate(hits, start=1):
        lines.append(f"[{i}] (doc#{chunk.document_id}) {chunk.text}")

    # Add GraphRAG Hybrid Context
    chunk_ids = [chunk.id for chunk, _ in hits]
    bindings = db.scalars(select(AgentKnowledge.document_id).where(AgentKnowledge.agent_id == agent_id)).all()

    if chunk_ids and bindings:
        # Get entity associations
        assoc_stmt = select(ChunkEntityAssociation.entity_id).where(ChunkEntityAssociation.chunk_id.in_(chunk_ids))
        entity_ids = db.scalars(assoc_stmt).all()

        if entity_ids:
            # Fetch entities
            entities = db.scalars(select(GraphEntity).where(GraphEntity.id.in_(entity_ids))).all()

            # Fetch relationships involving these entities
            rel_stmt = (
                select(GraphRelationship)
                .where(
                    (GraphRelationship.source_id.in_(entity_ids) | GraphRelationship.target_id.in_(entity_ids)) &
                    (GraphRelationship.document_id.in_(bindings))
                )
                .limit(10)
            )
            relationships = db.scalars(rel_stmt).all()

            if entities or relationships:
                lines.append("\n=== โครงข่ายความสัมพันธ์เพิ่มเติม (Knowledge Graph Relationships) ===")
                if entities:
                    lines.append("\nเอนทิตีที่เกี่ยวข้อง:")
                    for ent in entities:
                        desc = f": {ent.description}" if ent.description else ""
                        lines.append(f"- {ent.name} ({ent.entity_type}){desc}")
                if relationships:
                    lines.append("\nความเชื่อมโยงของข้อมูล:")
                    for rel in relationships:
                        desc = f" ({rel.description})" if rel.description else ""
                        lines.append(f"- [{rel.source.name}] --{rel.relation_type}--> [{rel.target.name}]{desc}")

    return "\n\n".join(lines)

