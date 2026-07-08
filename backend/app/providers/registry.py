from ..core.security import decrypt_secret
from ..models import LLMProvider
from .base import LLMProviderClient
from .openai_client import OpenAIClient
from .anthropic_client import AnthropicClient


def get_client(provider: LLMProvider) -> LLMProviderClient:
    api_key = decrypt_secret(provider.api_key_encrypted) if provider.api_key_encrypted else ""
    kind = provider.kind.lower()
    if kind in ("openai", "openrouter", "local", "ollama"):
        # OpenAI-compatible endpoints (OpenRouter, vLLM, Ollama) reuse the client.
        # For Ollama, fall back to the in-Docker hostname if no base_url is set.
        base_url = provider.base_url
        if kind == "ollama" and not base_url:
            base_url = "http://ollama:11434/v1"
        return OpenAIClient(api_key=api_key or "ollama", base_url=base_url, kind=kind)
    if kind == "anthropic":
        return AnthropicClient(api_key=api_key, base_url=provider.base_url)
    raise ValueError(f"Unsupported provider kind: {provider.kind}")
