import sys
from app.db.session import SessionLocal
from app.models import Document, DocumentChunk
from app.services.graph_extraction import extract_and_store_graph

def backfill():
    db = SessionLocal()
    try:
        # Get all active documents
        docs = db.query(Document).filter(Document.is_active == True).all()
        print(f"Found {len(docs)} active documents to process.")
        
        for doc in docs:
            print(f"Processing document: {doc.name} (ID: {doc.id})...")
            # Fetch all chunks for this document
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
            if not chunks:
                print(f"No chunks found for document {doc.id}. Skipping.")
                continue
            
            print(f"Extracting graph for {len(chunks)} chunks...")
            extract_and_store_graph(db, chunks, document_id=doc.id)
            print(f"Completed graph extraction for document {doc.id}.")
            
        print("Backfill completed successfully.")
    except Exception as e:
        print(f"Error during backfill: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
