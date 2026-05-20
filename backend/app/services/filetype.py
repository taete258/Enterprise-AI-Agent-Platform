"""Classify uploaded files as structured (tabular/data) or unstructured (free text)."""
from pathlib import Path

STRUCTURED_EXTS = {".csv", ".tsv", ".xlsx", ".xls", ".json", ".jsonl", ".parquet"}
UNSTRUCTURED_EXTS = {".pdf", ".txt", ".md", ".markdown", ".docx", ".doc", ".log", ".html", ".htm"}


def classify(filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext in STRUCTURED_EXTS:
        return "structured"
    if ext in UNSTRUCTURED_EXTS:
        return "unstructured"
    return "unknown"
