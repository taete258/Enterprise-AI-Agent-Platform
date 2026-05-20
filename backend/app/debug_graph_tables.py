from app.db.session import SessionLocal
from app.models import Document, DocumentChunk, GraphEntity, GraphRelationship, ChunkEntityAssociation

db = SessionLocal()
try:
    print("Documents count:", db.query(Document).count())
    print("Chunks count:", db.query(DocumentChunk).count())
    print("Graph Entities count:", db.query(GraphEntity).count())
    print("Graph Relationships count:", db.query(GraphRelationship).count())
    print("Associations count:", db.query(ChunkEntityAssociation).count())
    
    print("\nEntities:")
    for ent in db.query(GraphEntity).all():
        print(f"- ID: {ent.id}, Name: {ent.name}, Type: {ent.entity_type}")
        
    print("\nRelationships:")
    for rel in db.query(GraphRelationship).all():
        print(f"- Source ID: {rel.source_id}, Target ID: {rel.target_id}, Type: {rel.relation_type}")
finally:
    db.close()
