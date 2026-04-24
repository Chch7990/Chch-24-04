export type Role = "user" | "admin";

export type SessionUser = {
  uid: string;
  name: string;
  email: string;
  branch: string;
  role: Role;
  token?: string;
};

export const SESSION_KEY = "ilPortalSession.v1";

export function loadSession(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveSession(s: SessionUser) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("ilPortalSession:change"));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("ilPortalSession:change"));
}
