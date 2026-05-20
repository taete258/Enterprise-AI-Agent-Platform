"""PII egress filter — masks sensitive data before sending to external LLMs.

Patterns target Thai-context PII: Thai national ID (13 digit), phone numbers,
bank account numbers, email addresses, credit cards.
"""
import re

_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Thai national ID — 13 digits, optionally hyphen-separated (1-2345-67890-12-3)
    (re.compile(r"\b\d[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d\b"), "[THAI_ID]"),
    # Credit card 13-19 digits
    (re.compile(r"\b(?:\d[ -]*?){13,19}\b"), "[CARD]"),
    # Thai phone: 0XX-XXX-XXXX or +66
    (re.compile(r"\b(?:\+66|0)\d[\d\s\-]{7,12}\b"), "[PHONE]"),
    # Email
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "[EMAIL]"),
    # Generic 10-15 digit "account" runs (after the above more-specific patterns)
    (re.compile(r"\b\d{10,15}\b"), "[ACCOUNT]"),
]


def mask_pii(text: str) -> tuple[str, list[str]]:
    """Return (masked_text, list_of_categories_masked)."""
    if not text:
        return text, []
    hits: list[str] = []
    out = text
    for pat, label in _PATTERNS:
        if pat.search(out):
            hits.append(label)
            out = pat.sub(label, out)
    return out, hits
