"""Lightweight text extraction for uploaded docs."""
from io import BytesIO
from pathlib import Path


def extract_text(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext in (".txt", ".md", ".markdown", ".csv", ".log"):
        return data.decode("utf-8", errors="replace")
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(data))
        return "\n\n".join((p.extract_text() or "") for p in reader.pages)
    if ext == ".docx":
        from docx import Document as Docx
        d = Docx(BytesIO(data))
        return "\n".join(p.text for p in d.paragraphs)
    # Fallback: best-effort decode
    return data.decode("utf-8", errors="replace")


def chunk_text(text: str, *, chunk_size: int = 800, overlap: int = 120) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    # Split by paragraphs first, then pack
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 2 <= chunk_size:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                chunks.append(buf)
            if len(p) <= chunk_size:
                buf = p
            else:
                # hard-split long paragraph with overlap
                i = 0
                while i < len(p):
                    chunks.append(p[i:i + chunk_size])
                    i += chunk_size - overlap
                buf = ""
    if buf:
        chunks.append(buf)
    return chunks
