import { loadSession } from "./session";

export type ApiOpts = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

function buildHeaders(): HeadersInit {
  const s = loadSession();
  const h: Record<string, string> = { "content-type": "application/json" };
  if (s?.token) h["authorization"] = `Bearer ${s.token}`;
  if (s?.uid) h["x-portal-uid"] = s.uid;
  if (s?.name) h["x-portal-name"] = s.name;
  if (s?.branch) h["x-portal-branch"] = s.branch;
  if (s?.role) h["x-portal-role"] = s.role;
  return h;
}

export async function api<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  const r = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
    method: opts.method ?? "GET",
    headers: buildHeaders(),
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });
  let j: unknown;
  try {
    j = await r.json();
  } catch {
    j = { ok: false, error: `HTTP ${r.status}` };
  }
  if (!r.ok) {
    const err = (j as { error?: string })?.error || `HTTP ${r.status}`;
    throw new Error(err);
  }
  return j as T;
}

export const apiGet = <T>(p: string) => api<T>(p);
export const apiPost = <T>(p: string, body: unknown) => api<T>(p, { method: "POST", body });
export const apiPut = <T>(p: string, body: unknown) => api<T>(p, { method: "PUT", body });
export const apiDelete = <T>(p: string) => api<T>(p, { method: "DELETE" });
export const apiPatch = <T>(p: string, body: unknown) => api<T>(p, { method: "PATCH", body });
