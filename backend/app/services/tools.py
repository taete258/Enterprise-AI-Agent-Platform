import json
import math
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Tool


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
