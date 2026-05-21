"""Text-to-image provider abstraction.

Tool DB row controls which provider is used:
  - tool.url   → provider key ("openai" | "openrouter")
  - tool.headers (JSON) → provider opts (e.g. {"model": "openai/dall-e-3"})
"""
from __future__ import annotations

import base64
from typing import Protocol

from ..core.config import get_settings


class ImageProviderClient(Protocol):
    def generate(self, prompt: str, size: str, n: int, **opts) -> list[bytes]: ...


def _fetch_provider_key(kind: str) -> str:
    """Lookup an active LLM provider's decrypted API key from the DB."""
    from ..db.session import SessionLocal
    from ..models.llm import LLMProvider
    from ..core.security import decrypt_secret

    db = SessionLocal()
    try:
        prov = db.query(LLMProvider).filter(
            LLMProvider.kind == kind, LLMProvider.is_active == True
        ).first()
        if not prov or not prov.api_key_encrypted:
            return ""
        try:
            return decrypt_secret(prov.api_key_encrypted)
        except Exception:
            return ""
    finally:
        db.close()


class OpenAIImageClient:
    def __init__(self, model: str = "gpt-image-1", api_key: str | None = None):
        self.model = model
        self.api_key = api_key or get_settings().openai_api_key or _fetch_provider_key("openai")

    def generate(self, prompt: str, size: str = "1024x1024", n: int = 1, **opts) -> list[bytes]:
        from openai import OpenAI

        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        client = OpenAI(api_key=self.api_key)
        kwargs = {"model": self.model, "prompt": prompt, "size": size, "n": n}
        if self.model.startswith("dall-e"):
            kwargs["response_format"] = "b64_json"
        resp = client.images.generate(**kwargs)
        out: list[bytes] = []
        for item in resp.data:
            b64 = getattr(item, "b64_json", None)
            if not b64:
                continue
            out.append(base64.b64decode(b64))
        return out


class OpenRouterImageClient:
    """OpenRouter image generation via /chat/completions with image output modality.

    Compatible with image-output models such as
    `google/gemini-2.5-flash-image-preview`. The model must support image output.
    """

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, model: str = "google/gemini-2.5-flash-image-preview", api_key: str | None = None):
        self.model = model
        self.api_key = api_key or _fetch_provider_key("openrouter")

    def _decode_data_url(self, url: str) -> bytes | None:
        # data:image/png;base64,XXXX
        if not url.startswith("data:"):
            return None
        try:
            _, b64 = url.split(",", 1)
            return base64.b64decode(b64)
        except Exception:
            return None

    def generate(self, prompt: str, size: str = "1024x1024", n: int = 1, **opts) -> list[bytes]:
        import httpx

        if not self.api_key:
            raise RuntimeError("OpenRouter API key not found (configure it in Providers UI)")

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Agent v2",
        }
        with httpx.Client(timeout=180.0) as client:
            resp = client.post(f"{self.BASE_URL}/chat/completions", headers=headers, json=payload)
            if resp.status_code >= 400:
                raise RuntimeError(f"OpenRouter {resp.status_code}: {resp.text[:500]}")
            data = resp.json()

        out: list[bytes] = []
        choices = data.get("choices") or []
        if not choices:
            return out
        msg = choices[0].get("message") or {}

        # Pattern A: message.images = [{"type":"image_url","image_url":{"url":"data:..."}}]
        for img in msg.get("images") or []:
            url = (img.get("image_url") or {}).get("url") if isinstance(img, dict) else None
            if not url:
                continue
            b = self._decode_data_url(url)
            if b:
                out.append(b)
                continue
            # remote URL fallback
            with httpx.Client(timeout=60.0) as c2:
                r = c2.get(url)
                if r.status_code < 400:
                    out.append(r.content)

        # Pattern B: message.content as list of parts with image_url
        content = msg.get("content")
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                url = (part.get("image_url") or {}).get("url") if part.get("type") == "image_url" else None
                if not url:
                    continue
                b = self._decode_data_url(url)
                if b:
                    out.append(b)

        return out


def get_image_client(provider: str, opts: dict) -> ImageProviderClient:
    provider = (provider or "openai").lower()
    if provider == "openai":
        return OpenAIImageClient(model=opts.get("model", "gpt-image-1"))
    if provider == "openrouter":
        return OpenRouterImageClient(model=opts.get("model", "openai/dall-e-3"))
    raise RuntimeError(f"Unsupported image provider: {provider}")
