export const PERMISSIONS = {
  AGENT: {
    VIEW: "agent:view",
    USE: "agent:use",
    CREATE: "agent:create",
    EDIT: "agent:edit",
    DELETE: "agent:delete",
    ADMIN: "agent:admin",
  },
  LLM: {
    VIEW: "llm:view",
    CREATE: "llm:create",
    EDIT: "llm:edit",
    DELETE: "llm:delete",
    ADMIN: "llm:admin",
  },
  TOOL: {
    VIEW: "tool:view",
    CREATE: "tool:create",
    EDIT: "tool:edit",
    DELETE: "tool:delete",
    ADMIN: "tool:admin",
  },
  KNOWLEDGE: {
    VIEW: "knowledge:view",
    CREATE: "knowledge:create",
    EDIT: "knowledge:edit",
    DELETE: "knowledge:delete",
    ADMIN: "knowledge:admin",
  },
  USER: {
    VIEW: "user:view",
    CREATE: "user:create",
    EDIT: "user:edit",
    DELETE: "user:delete",
    ADMIN: "user:admin",
  },
  ADMIN: {
    VIEW: "admin:view",
    MANAGE: "admin:manage",
  },
} as const;

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some((p) => permissions.includes(p));
}

export function hasAllPermissions(permissions: string[], required: string[]): boolean {
  return required.every((p) => permissions.includes(p));
}
