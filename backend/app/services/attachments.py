import base64
import hashlib
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException

from .extractor import extract_text

ATTACHMENT_ROOT = Path(os.environ.get("CHAT_ATTACHMENT_STORAGE", "/app/storage/chat_attachments"))
ATTACHMENT_ROOT.mkdir(parents=True, exist_ok=True)

MAX_FILE_BYTES = int(os.environ.get("CHAT_ATTACHMENT_MAX_BYTES", str(15 * 1024 * 1024)))
MAX_IMAGE_BYTES = int(os.environ.get("CHAT_ATTACHMENT_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
MAX_TEXT_CHARS_PER_FILE = 20_000

TEXT_EXTRACTABLE_EXTS = {
    ".txt", ".md", ".markdown", ".log", ".csv", ".tsv",
    ".json", ".jsonl", ".xlsx", ".xls", ".pdf", ".docx",
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
IMAGE_MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


async def save_chat_attachments(files: list[UploadFile]) -> tuple[list[dict], str, list[dict]]:
    """Persist uploaded files.

    Returns (metadata, extracted-text-block, image_payloads). `image_payloads` is
    a list of {"mime","b64","name"} for image files so providers can pass them
    as multimodal content to vision-capable models.
    """
    meta: list[dict] = []
    text_blocks: list[str] = []
    images: list[dict] = []
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

        content_type = f.content_type or ""
        is_image = suffix in IMAGE_EXTS or content_type.startswith("image/")

        meta.append({
            "name": f.filename,
            "size": len(data),
            "mime": content_type or (IMAGE_MIME_BY_EXT.get(suffix, "") if is_image else ""),
            "path": str(storage_path),
            "hash": digest,
        })

        if is_image:
            if len(data) <= MAX_IMAGE_BYTES:
                images.append({
                    "name": f.filename,
                    "mime": content_type or IMAGE_MIME_BY_EXT.get(suffix, "image/png"),
                    "b64": base64.b64encode(data).decode("ascii"),
                })
            text_blocks.append(f"[Attached image: {f.filename}]")
            continue

        if suffix not in TEXT_EXTRACTABLE_EXTS:
            text_blocks.append(f"[Attached file: {f.filename} ({content_type or 'binary'})]")
            continue

        try:
            text = extract_text(f.filename, data) or ""
        except Exception:
            text = ""
        text = text.strip()
        if text:
            if len(text) > MAX_TEXT_CHARS_PER_FILE:
                text = text[:MAX_TEXT_CHARS_PER_FILE] + "\n…[truncated]"
            text_blocks.append(f"--- Attachment: {f.filename} ---\n{text}")
        else:
            text_blocks.append(f"[Attached file: {f.filename} (no extractable text)]")

    attachment_text = "\n\n".join(text_blocks)
    return meta, attachment_text, images
