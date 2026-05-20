from app.db.session import SessionLocal
from app.models import Document, DocumentVersion
from app.services.extractor import extract_text, chunk_text
import os

db = SessionLocal()
try:
    doc = db.query(Document).order_by(Document.id.desc()).first()
    if not doc:
        print("No documents found in database.")
    else:
        print(f"Document ID: {doc.id}, Name: {doc.name}, Active: {doc.is_active}")
        version = db.query(DocumentVersion).filter(DocumentVersion.document_id == doc.id).first()
        if not version:
            print("No version found.")
        else:
            print(f"Version storage path: {version.storage_path}, Size: {version.size_bytes}")
            if os.path.exists(version.storage_path):
                data = open(version.storage_path, "rb").read()
                print("File content size on disk:", len(data))
                text = extract_text(doc.name, data)
                print("Extracted text length:", len(text))
                print("Extracted text preview:", repr(text[:200]))
                chunks = chunk_text(text)
                print("Number of chunks:", len(chunks))
            else:
                print("File storage path does not exist on disk!")
finally:
    db.close()
