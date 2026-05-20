import hashlib
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException

from .extractor import extract_text

ATTACHMENT_ROOT = Path(os.environ.get("CHAT_ATTACHMENT_STORAGE", "/app/storage/chat_attachments"))
ATTACHMENT_ROOT.mkdir(parents=True, exist_ok=True)

MAX_FILE_BYTES = int(os.environ.get("CHAT_ATTACHMENT_MAX_BYTES", str(15 * 1024 * 1024)))
MAX_TEXT_CHARS_PER_FILE = 20_000


async def save_chat_attachments(files: list[UploadFile]) -> tuple[list[dict], str]:
    """Persist uploaded files; return (metadata list, extracted-text block for LLM)."""
    meta: list[dict] = []
    text_blocks: list[str] = []
    for f in files:
        if not f or not f.filename:
            continue
        data = await f.read()
        if not data:
            continue
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, f"Attachment '{f.filename}' exceeds size limit")

        digest = hashlib.sha256(data).hexdigest()
        suffix = Path(f.filename).suffix.lower()
        sub = ATTACHMENT_ROOT / digest[:2]
        sub.mkdir(parents=True, exist_ok=True)
        storage_path = sub / f"{digest}{suffix}"
        if not storage_path.exists():
            storage_path.write_bytes(data)

        meta.append({
            "name": f.filename,
            "size": len(data),
            "mime": f.content_type or "",
            "path": str(storage_path),
            "hash": digest,
        })

        try:
            text = extract_text(f.filename, data) or ""
        except Exception:
            text = ""
        text = text.strip()
        if text:
            if len(text) > MAX_TEXT_CHARS_PER_FILE:
                text = text[:MAX_TEXT_CHARS_PER_FILE] + "\n…[truncated]"
            text_blocks.append(f"--- Attachment: {f.filename} ---\n{text}")

    attachment_text = "\n\n".join(text_blocks)
    return meta, attachment_text
