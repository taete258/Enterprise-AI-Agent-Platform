"""
Centralized permission registry using resource:action naming convention.
All permission keys in the system must come from this registry.
"""

# Flat list of all permission keys
ALL_PERMISSIONS: list[str] = [
    # Agent permissions
    "agent:view",
    "agent:use",
    "agent:create",
    "agent:edit",
    "agent:delete",
    "agent:admin",
    # LLM (model/provider) permissions
    "llm:view",
    "llm:create",
    "llm:edit",
    "llm:delete",
    "llm:admin",
    # Tool permissions
    "tool:view",
    "tool:create",
    "tool:edit",
    "tool:delete",
    "tool:admin",
    # Knowledge (documents) permissions
    "knowledge:view",
    "knowledge:create",
    "knowledge:edit",
    "knowledge:delete",
    "knowledge:admin",
    # User management permissions
    "user:view",
    "user:create",
    "user:edit",
    "user:delete",
    "user:admin",
    # Admin-level permissions (costs, audit, etc.)
    "admin:view",
    "admin:manage",
]

ALL_PERMISSIONS_SET: set[str] = set(ALL_PERMISSIONS)

# Grouped by resource for UI rendering
PERMISSIONS_BY_RESOURCE: dict[str, list[str]] = {
    "agent": ["agent:view", "agent:use", "agent:create", "agent:edit", "agent:delete", "agent:admin"],
    "llm": ["llm:view", "llm:create", "llm:edit", "llm:delete", "llm:admin"],
    "tool": ["tool:view", "tool:create", "tool:edit", "tool:delete", "tool:admin"],
    "knowledge": ["knowledge:view", "knowledge:create", "knowledge:edit", "knowledge:delete", "knowledge:admin"],
    "user": ["user:view", "user:create", "user:edit", "user:delete", "user:admin"],
    "admin": ["admin:view", "admin:manage"],
}

# Predefined role templates (used for seeding)
DEFAULT_ROLES: dict[str, dict] = {
    "admin": {
        "description": "Full system access",
        "permissions": ALL_PERMISSIONS,
    },
    "editor": {
        "description": "Can create and edit resources",
        "permissions": [
            "agent:view", "agent:use", "agent:create", "agent:edit",
            "llm:view",
            "tool:view",
            "knowledge:view", "knowledge:create", "knowledge:edit",
        ],
    },
    "operator": {
        "description": "Can use agents and tools",
        "permissions": [
            "agent:view", "agent:use",
            "tool:view",
            "knowledge:view",
        ],
    },
    "viewer": {
        "description": "Read-only access",
        "permissions": [
            "agent:view",
            "llm:view",
            "tool:view",
            "knowledge:view",
        ],
    },
}


def validate_permissions(permissions: list[str]) -> list[str]:
    """Filter permissions to only include valid ones from registry."""
    return [p for p in permissions if p in ALL_PERMISSIONS_SET]


def is_valid_permission(permission: str) -> bool:
    return permission in ALL_PERMISSIONS_SET
