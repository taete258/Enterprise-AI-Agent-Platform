import hashlib
import os
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.session import get_db
from ..models import Document, DocumentVersion, DocumentChunk, AgentKnowledge, Agent, User, GraphEntity, GraphRelationship
from ..schemas.knowledge import DocumentOut, DocumentVersionOut, BindKnowledge, GraphDataOut
from ..services.extractor import extract_text, chunk_text
from ..services.filetype import classify
from ..services.embeddings import embed_texts
from ..services.graph_extraction import extract_and_store_graph
from ..services.audit import log_action
from .deps import get_current_user

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

STORAGE_ROOT = Path(os.environ.get("DOC_STORAGE", "/app/storage"))
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)


def _store(content_hash: str, data: bytes, suffix: str) -> Path:
    sub = STORAGE_ROOT / content_hash[:2]
    sub.mkdir(parents=True, exist_ok=True)
    path = sub / f"{content_hash}{suffix}"
    if not path.exists():
        path.write_bytes(data)
    return path


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Document).where(Document.is_active == True).order_by(Document.id.desc())).all()


@router.post("/upload", response_model=DocumentOut)
async def upload(
    file: UploadFile = File(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    content_hash = hashlib.sha256(data).hexdigest()
    suffix = Path(file.filename or "").suffix.lower()

    existing = db.scalar(select(Document).where(Document.content_hash == content_hash, Document.is_active == True))
    if existing:
        # treat as no-op idempotent upload
        return existing

    doc = Document(
        name=file.filename or "untitled",
        description=description,
        content_hash=content_hash,
        uploader_id=user.id,
    )
    db.add(doc); db.flush()

    storage_path = _store(content_hash, data, suffix)
    version = DocumentVersion(
        document_id=doc.id,
        version=1,
        storage_path=str(storage_path),
        mime_type=file.content_type or "",
        size_bytes=len(data),
    )
    db.add(version); db.flush()

    # Extract → chunk → embed
    text = extract_text(file.filename or "", data)
    chunks = chunk_text(text)
    if chunks:
        try:
            vectors = embed_texts(db, chunks)
        except Exception as e:
            db.rollback()
            raise HTTPException(502, f"Embedding failed: {e}")
        chunks_list = []
        for i, (c, v) in enumerate(zip(chunks, vectors)):
            chunk_obj = DocumentChunk(
                document_id=doc.id, version_id=version.id, ordinal=i, text=c, embedding=v,
            )
            db.add(chunk_obj)
            chunks_list.append(chunk_obj)
        db.flush()
        
        # Run GraphRAG extraction
        extract_and_store_graph(db, chunks_list, doc.id)

    log_action(
        db, user_id=user.id, action="knowledge.upload",
        resource_type="document", resource_id=str(doc.id),
        detail={"chunks": len(chunks), "bytes": len(data), "doc_type": classify(file.filename or "")},
    )
    db.commit(); db.refresh(doc)
    return doc


@router.get("/{document_id}/versions", response_model=list[DocumentVersionOut])
def versions(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(DocumentVersion).where(DocumentVersion.document_id == document_id)).all()


@router.delete("/{document_id}")
def deprecate(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404)
    if not (user.is_superuser or doc.uploader_id == user.id):
        raise HTTPException(403)
    doc.is_active = False
    log_action(db, user_id=user.id, action="knowledge.deprecate", resource_type="document", resource_id=str(doc.id))
    db.commit()
    return {"ok": True}


@router.post("/bind")
def bind(payload: BindKnowledge, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = db.get(Agent, payload.agent_id)
    doc = db.get(Document, payload.document_id)
    if not agent or not doc:
        raise HTTPException(404)
    if not (user.is_superuser or agent.owner_id == user.id):
        raise HTTPException(403)
    exists = db.scalar(
        select(AgentKnowledge).where(
            AgentKnowledge.agent_id == agent.id, AgentKnowledge.document_id == doc.id
        )
    )
    if not exists:
        db.add(AgentKnowledge(agent_id=agent.id, document_id=doc.id))
        log_action(
            db, user_id=user.id, action="knowledge.bind",
            resource_type="agent", resource_id=str(agent.id),
            detail={"document_id": doc.id},
        )
        db.commit()
    return {"ok": True}


@router.post("/unbind")
def unbind(payload: BindKnowledge, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = db.get(Agent, payload.agent_id)
    if not agent:
        raise HTTPException(404)
    if not (user.is_superuser or agent.owner_id == user.id):
        raise HTTPException(403)
    db.query(AgentKnowledge).filter_by(agent_id=payload.agent_id, document_id=payload.document_id).delete()
    db.commit()
    return {"ok": True}


@router.get("/graph", response_model=GraphDataOut)
def get_knowledge_graph(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Retrieve all active graph nodes and relationships."""
    entities = db.scalars(select(GraphEntity)).all()
    relationships = db.scalars(select(GraphRelationship)).all()
    
    nodes = [
        {"id": ent.id, "label": ent.name, "type": ent.entity_type, "description": ent.description or ""}
        for ent in entities
    ]
    edges = [
        {
            "id": rel.id,
            "source": rel.source_id,
            "target": rel.target_id,
            "type": rel.relation_type,
            "description": rel.description or ""
        }
        for rel in relationships
    ]
    return {"nodes": nodes, "edges": edges}

