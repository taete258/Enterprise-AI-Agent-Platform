import hashlib
import json
import math
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Tool, LLMModel
from . import storage
from ..core.config import get_settings
from ..providers.image_client import get_image_client
from ..db.session import SessionLocal


def _get_image_generation_model() -> tuple[str, dict]:
    """
    Query for a model with supports_image_generation=True.
    Returns (provider_kind, model_config_dict) where model_config_dict has model_id and optionally model name.
    Falls back to default if none found.
    """
    db = SessionLocal()
    try:
        # Query for first active model that supports image generation
        model = db.scalar(
            select(LLMModel)
            .where(LLMModel.supports_image_generation == True, LLMModel.is_active == True)
        )
        if model and model.provider:
            return model.provider.kind, {"model": model.model_id}
    except Exception:
        pass
    finally:
        db.close()

    # Fallback to default
    return "openrouter", {"model": "google/gemini-2.5-flash-image-preview"}


def safe_eval(expr: str) -> str:
    """Safely evaluate mathematical expressions using limited globals."""
    allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
    allowed_names.update({
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "sum": sum,
        "pow": pow,
    })
    try:
        # Strip common dangerous inputs
        expr_clean = expr.replace("import", "").replace("eval", "").replace("exec", "").strip()
        # safe eval
        res = eval(expr_clean, {"__builtins__": None}, allowed_names)
        return str(res)
    except Exception as e:
        return f"Error evaluating math expression: {e}"


def _run_generate_image(tool: Tool | None, args: dict, agent_config_str: str) -> str:
    prompt = (args.get("prompt") or "").strip()
    if not prompt:
        return "Error: 'prompt' is required for generate_image."
    size = args.get("size") or "1024x1024"
    try:
        n = int(args.get("n") or 1)
    except (TypeError, ValueError):
        n = 1
    n = max(1, min(n, 4))

    # Priority: agent config > tool config > database query > hardcoded fallback
    provider = None
    opts = {}
    model_used = None

    # Check agent config first
    if agent_config_str:
        try:
            agent_cfg = json.loads(agent_config_str) or {}
            if isinstance(agent_cfg.get("image"), dict):
                opts.update(agent_cfg["image"])
            if agent_cfg.get("provider"):
                provider = agent_cfg["provider"]
        except Exception:
            pass

    # Check tool config if no agent override
    if not provider and tool:
        try:
            provider = tool.url
            if tool.headers:
                tool_opts = json.loads(tool.headers)
                opts.update(tool_opts)
        except Exception:
            pass

    # Query database for models with supports_image_generation if no explicit config
    if not provider or not opts.get("model"):
        db_provider, db_opts = _get_image_generation_model()
        if not provider:
            provider = db_provider
        if not opts.get("model"):
            opts.update(db_opts)
            model_used = db_opts.get("model")

    # Final fallback
    if not provider:
        provider = "openrouter"
    if not opts.get("model"):
        opts["model"] = "google/gemini-2.5-flash-image-preview"

    model_used = model_used or opts.get("model", "unknown")

    try:
        client = get_image_client(provider, opts)
        images = client.generate(prompt=prompt, size=size, n=n)
    except Exception as e:
        return f"Image generation failed: {e}"

    if not images:
        return "Image generation returned no images."

    bucket = get_settings().minio_bucket_images
    out = []
    for img_bytes in images:
        sha = hashlib.sha256(img_bytes).hexdigest()
        key = f"{sha[:2]}/{sha}.png"
        if not storage.object_exists(bucket, key):
            storage.put_object(bucket, key, img_bytes, content_type="image/png")
        out.append({"url": storage.presigned_url(bucket, key), "key": key})
    return json.dumps({"prompt": prompt, "size": size, "model": model_used, "images": out})


def execute_tool(db: Session, tool_key: str, args: dict, agent_config_str: str) -> str:
    """Execute a tool by key, merging agent-specific overrides."""
    # 1. System Calculator
    if tool_key == "calculator":
        expression = args.get("expression", "")
        return safe_eval(expression)

    # 2. Fetch tool from DB
    tool = db.scalar(select(Tool).where(Tool.key == tool_key))
    if not tool:
        return f"Error: Tool '{tool_key}' not found in database."

    if tool.type == "system" and tool.key == "calculator":
        expression = args.get("expression", "")
        return safe_eval(expression)

    if tool.key == "generate_image":
        return _run_generate_image(tool, args, agent_config_str)

    if tool.type == "api":
        url = tool.url
        if not url:
            return f"Error: Tool '{tool_key}' does not have a configured URL."

        # Parse baseline headers
        try:
            headers = json.loads(tool.headers or "{}")
        except Exception:
            headers = {}

        # Parse agent configuration overrides
        agent_config = {}
        if agent_config_str:
            try:
                agent_config = json.loads(agent_config_str)
            except Exception:
                pass

        # Merge headers from agent config if any
        agent_headers = agent_config.get("headers", {})
        if isinstance(agent_headers, dict):
            headers.update(agent_headers)

        # Prepend base URL overrides if configured in agent config
        base_url = agent_config.get("base_url", "")
        if base_url:
            base_url = base_url.rstrip("/")
            if url.startswith("/"):
                url = base_url + url
            else:
                # absolute url or needs replacement
                pass

        # Handle local relative API paths
        if url.startswith("/api/"):
            url = f"http://localhost:8000{url}"

        method = (tool.method or "GET").upper()

        try:
            with httpx.Client(timeout=15.0) as client:
                if method in ("POST", "PUT", "PATCH"):
                    resp = client.request(method, url, headers=headers, json=args)
                else:
                    resp = client.request(method, url, headers=headers, params=args)

                if resp.status_code >= 400:
                    return f"API Error (Status {resp.status_code}): {resp.text}"
                return resp.text
        except Exception as e:
            return f"HTTP Request Failed: {e}"

    return f"Error: Tool '{tool_key}' has unsupported type '{tool.type}'."
