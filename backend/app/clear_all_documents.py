from app.db.session import SessionLocal
from app.models import Document, DocumentChunk, GraphEntity, GraphRelationship, ChunkEntityAssociation, AgentKnowledge, DocumentVersion

def clear_data():
    db = SessionLocal()
    try:
        # Delete associations first because of foreign keys
        print("Clearing AgentKnowledge bindings...")
        db.query(AgentKnowledge).delete()
        
        print("Clearing ChunkEntityAssociation...")
        db.query(ChunkEntityAssociation).delete()
        
        print("Clearing GraphRelationship...")
        db.query(GraphRelationship).delete()
        
        print("Clearing GraphEntity...")
        db.query(GraphEntity).delete()
        
        print("Clearing DocumentChunk...")
        db.query(DocumentChunk).delete()

        print("Clearing DocumentVersion...")
        db.query(DocumentVersion).delete()
        
        print("Clearing Document...")
        db.query(Document).delete()
        
        db.commit()
        print("Successfully cleared all documents and graph data.")
    except Exception as e:
        db.rollback()
        print(f"Error during clearing data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_data()
