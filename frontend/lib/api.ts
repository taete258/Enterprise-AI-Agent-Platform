export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function redirectToUnauthorized() {
  if (typeof window === "undefined") return;
  const segments = window.location.pathname.split("/");
  const locale = (segments[1] === "en" || segments[1] === "th") ? segments[1] : "th";
  if (locale) {
    window.location.href = `/${locale}/unauthorized?from=${encodeURIComponent(window.location.pathname)}`;
  }
}

export function isTokenValid(t: string | null): boolean {
  if (!t) return false;
  try {
    const parts = t.split(".");
    if (parts.length !== 3) return false;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const payload = JSON.parse(atob(base64));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.includes("/api/auth/login")) {
      localStorage.removeItem("token");
      redirectToUnauthorized();
    }
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<{ id: number; email: string; full_name: string; is_active: boolean; is_superuser: boolean; created_at: string; roles: { id: number; name: string; description: string }[] }>("/api/auth/me"),
  myPermissions: () => api<{ permissions: string[] }>("/api/auth/me/permissions"),
};

export const agents = {
  list: () => api<any[]>("/api/agents"),
  get: (id: number) => api(`/api/agents/${id}`),
  create: (data: any) => api("/api/agents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => api(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => api(`/api/agents/${id}`, { method: "DELETE" }),
  chat: async (data: { session_id?: number; agent_id: number; message: string; files?: File[] }) => {
    const fd = new FormData();
    fd.append("agent_id", String(data.agent_id));
    fd.append("message", data.message);
    if (data.session_id != null) fd.append("session_id", String(data.session_id));
    for (const f of data.files || []) fd.append("files", f);
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_URL}/api/agents/chat`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: fd,
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("token");
        redirectToUnauthorized();
      }
      throw new Error(`${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<{
      session_id: number; reply: string; citations: any[]; tokens_in: number; tokens_out: number;
    }>;
  },
  attachmentUrl: (messageId: number, filename: string) =>
    `${API_URL}/api/agents/chat/attachments/${messageId}/${encodeURIComponent(filename)}`,
  listTools: (agentId: number) => api<any[]>(`/api/agents/${agentId}/tools`),
  updateTools: (agentId: number, data: any[]) =>
    api(`/api/agents/${agentId}/tools`, { method: "PUT", body: JSON.stringify(data) }),
  listKnowledge: (agentId: number) => api<any[]>(`/api/agents/${agentId}/knowledge`),
};

export const llm = {
  models: () => api<any[]>("/api/llm/models"),
  providers: () => api<any[]>("/api/llm/providers"),
  createProvider: (data: any) => api("/api/llm/providers", { method: "POST", body: JSON.stringify(data) }),
  updateProvider: (id: number, data: any) =>
    api(`/api/llm/providers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProvider: (id: number) => api(`/api/llm/providers/${id}`, { method: "DELETE" }),
  testConfig: (data: { kind: string; base_url?: string; api_key: string }) =>
    api<{ ok: boolean; error?: string; model_count?: number; probe_model?: string }>(
      "/api/llm/providers/test-config", { method: "POST", body: JSON.stringify(data) }
    ),
  testProvider: (id: number) =>
    api<{ ok: boolean; error?: string; model_count?: number; probe_model?: string }>(
      `/api/llm/providers/${id}/test`, { method: "POST" }
    ),
  availableModels: (id: number) =>
    api<{ ok: boolean; models: { id: string; display: string }[] }>(
      `/api/llm/providers/${id}/available-models`
    ),
  createModel: (data: any) => api("/api/llm/models", { method: "POST", body: JSON.stringify(data) }),
  updateModel: (id: number, data: any) =>
    api(`/api/llm/models/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteModel: (id: number) => api(`/api/llm/models/${id}`, { method: "DELETE" }),
};

export const knowledge = {
  list: () => api<any[]>("/api/knowledge"),
  upload: async (file: File, description = "") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("description", description);
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_URL}/api/knowledge/upload`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  },
  deprecate: (id: number) => api(`/api/knowledge/${id}`, { method: "DELETE" }),
  bind: (agent_id: number, document_id: number) =>
    api("/api/knowledge/bind", { method: "POST", body: JSON.stringify({ agent_id, document_id }) }),
  unbind: (agent_id: number, document_id: number) =>
    api("/api/knowledge/unbind", { method: "POST", body: JSON.stringify({ agent_id, document_id }) }),
  graph: () => api<{ nodes: any[]; edges: any[] }>("/api/knowledge/graph"),
};

export const sessions = {
  list: (includeArchived = false) =>
    api<any[]>(`/api/sessions${includeArchived ? "?include_archived=true" : ""}`),
  messages: (id: number, opts?: { limit?: number; before_id?: number }) => {
    const p = new URLSearchParams();
    if (opts?.limit) p.set("limit", String(opts.limit));
    if (opts?.before_id) p.set("before_id", String(opts.before_id));
    const qs = p.toString();
    return api<any[]>(`/api/sessions/${id}/messages${qs ? "?" + qs : ""}`);
  },
  update: (id: number, data: { title?: string; is_pinned?: boolean; is_archived?: boolean; group_id?: number | null }) =>
    api(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  listGroups: () => api<any[]>("/api/sessions/groups"),
  createGroup: (name: string) =>
    api("/api/sessions/groups", { method: "POST", body: JSON.stringify({ name }) }),
  updateGroup: (id: number, data: { name?: string; delete?: boolean }) =>
    api(`/api/sessions/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteGroup: (id: number) =>
    api(`/api/sessions/groups/${id}`, { method: "DELETE" }),
};

export const admin = {
  costs: (days = 30) => api<any>(`/api/admin/costs?days=${days}`),
  audit: (limit = 100) => api<any[]>(`/api/admin/audit?limit=${limit}`),
  users: () => api<any[]>("/api/admin/users"),
  createUser: (data: { email: string; full_name: string; password: string }) =>
    api("/api/auth/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => api(`/api/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: number) => api(`/api/auth/users/${id}`, { method: "DELETE" }),
  getUserPermissions: (id: number) => api<{ user_id: number; permissions: string[] }>(`/api/admin/users/${id}/permissions`),
  assignRole: (userId: number, roleId: number) =>
    api(`/api/admin/users/${userId}/roles?role_id=${roleId}`, { method: "POST" }),
  removeRole: (userId: number, roleId: number) =>
    api(`/api/admin/users/${userId}/roles/${roleId}`, { method: "DELETE" }),
  listTools: () => api<any[]>("/api/admin/tools"),
  createTool: (data: any) => api("/api/admin/tools", { method: "POST", body: JSON.stringify(data) }),
  updateTool: (id: number, data: any) => api(`/api/admin/tools/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTool: (id: number) => api(`/api/admin/tools/${id}`, { method: "DELETE" }),
  testTool: (data: { url: string; method?: string; headers?: string; parameters?: string }) =>
    api(`/api/admin/tools/test`, { method: "POST", body: JSON.stringify(data) }),
  // Role management
  roles: () => api<any[]>("/api/admin/roles"),
  createRole: (data: { name: string; description: string; permissions: string[] }) =>
    api("/api/admin/roles", { method: "POST", body: JSON.stringify(data) }),
  updateRole: (id: number, data: { description?: string; permissions?: string[] }) =>
    api(`/api/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRole: (id: number) => api(`/api/admin/roles/${id}`, { method: "DELETE" }),
  permissions: () => api<{ permissions: Record<string, string[]> }>("/api/admin/permissions"),
};
