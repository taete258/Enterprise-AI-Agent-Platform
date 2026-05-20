export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
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
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = `/unauthorized?from=${encodeURIComponent(window.location.pathname)}`;
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
  me: () => api("/api/auth/me"),
};

export const agents = {
  list: () => api<any[]>("/api/agents"),
  get: (id: number) => api(`/api/agents/${id}`),
  create: (data: any) => api("/api/agents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => api(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  chat: (data: { session_id?: number; agent_id: number; message: string }) =>
    api<{ session_id: number; reply: string; citations: any[]; tokens_in: number; tokens_out: number }>(
      "/api/agents/chat",
      { method: "POST", body: JSON.stringify(data) }
    ),
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
};

export const sessions = {
  list: () => api<any[]>("/api/sessions"),
  messages: (id: number) => api<any[]>(`/api/sessions/${id}/messages`),
};

export const admin = {
  costs: (days = 30) => api<any>(`/api/admin/costs?days=${days}`),
  audit: (limit = 100) => api<any[]>(`/api/admin/audit?limit=${limit}`),
  users: () => api<any[]>("/api/admin/users"),
  createUser: (data: { email: string; full_name: string; password: string }) =>
    api("/api/auth/users", { method: "POST", body: JSON.stringify(data) }),
};
