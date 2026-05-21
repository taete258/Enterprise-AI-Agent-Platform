"""One-shot migration: push pre-existing local /app/storage files into MinIO.

Run inside the backend container after MinIO is healthy:
    docker compose exec backend python -m backend.scripts.migrate_storage_to_minio

It walks:
  - /app/storage/*/<sha>.<ext>                    → docs bucket
  - /app/storage/chat_attachments/*/<sha>.<ext>   → attachments bucket

Object key layout matches the new code: <sha[:2]>/<sha><ext>. Idempotent — skips
files already present in the target bucket. DB rows in `document_versions` and
chat message metadata keep working because their stored `storage_path` already
has the same `<sha[:2]>/<sha><ext>` shape after this script runs (we update
existing absolute-path rows in-place).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow running as `python -m backend.scripts.migrate_storage_to_minio` or directly
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import storage  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models import DocumentVersion  # noqa: E402


def _migrate_tree(root: Path, bucket: str) -> int:
    if not root.exists():
        print(f"  (skip) {root} does not exist")
        return 0
    n = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        # Skip nested attachments dir when walking the docs root
        if path.parts[len(root.parts):len(root.parts) + 1] == ("chat_attachments",):
            continue
        rel = path.relative_to(root)
        # Expect <prefix>/<sha><ext>
        if len(rel.parts) < 2:
            continue
        key = "/".join(rel.parts[-2:])
        if storage.object_exists(bucket, key):
            continue
        data = path.read_bytes()
        storage.put_object(bucket, key, data, content_type="application/octet-stream")
        n += 1
        print(f"  uploaded {bucket}/{key} ({len(data)} bytes)")
    return n


def _fix_document_version_paths() -> int:
    """Rewrite absolute filesystem paths to bucket-relative object keys."""
    db = SessionLocal()
    fixed = 0
    try:
        for v in db.query(DocumentVersion).all():
            p = v.storage_path or ""
            if "/" not in p:
                continue
            if p.startswith("/app/storage/"):
                tail = p[len("/app/storage/"):]
                # tail = "ab/abc...pdf"  (skip if it accidentally has chat_attachments prefix)
                if tail.startswith("chat_attachments/"):
                    continue
                if "/" in tail and len(tail.split("/")[0]) == 2:
                    v.storage_path = tail
                    fixed += 1
        if fixed:
            db.commit()
    finally:
        db.close()
    return fixed


def main() -> None:
    s = get_settings()
    storage.ensure_buckets()
    print(f"Migrating /app/storage → bucket '{s.minio_bucket_docs}'")
    docs_root = Path(os.environ.get("DOC_STORAGE", "/app/storage"))
    docs_n = _migrate_tree(docs_root, s.minio_bucket_docs)

    print(f"Migrating /app/storage/chat_attachments → bucket '{s.minio_bucket_attachments}'")
    att_root = Path(os.environ.get("CHAT_ATTACHMENT_STORAGE", "/app/storage/chat_attachments"))
    att_n = _migrate_tree(att_root, s.minio_bucket_attachments)

    print("Rewriting DocumentVersion.storage_path to object-key form")
    fixed = _fix_document_version_paths()

    print(f"\nDone. docs uploaded={docs_n}, attachments uploaded={att_n}, db rows fixed={fixed}")


if __name__ == "__main__":
    main()
