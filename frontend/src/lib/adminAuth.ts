/**
 * Admin session lives in sessionStorage only:
 * - Closing the tab/window ends the session (must log in again).
 * - Visiting /admin never auto-opens the dashboard; user signs in or continues explicitly.
 */
export const ADMIN_TOKEN_KEY = "adminToken";
export const ADMIN_USER_KEY = "adminUser";

const storage = (): Storage | null =>
  typeof window !== "undefined" ? window.sessionStorage : null;

export function getAdminToken(): string | null {
  const s = storage();
  if (!s) return null;
  let t = s.getItem(ADMIN_TOKEN_KEY);
  if (!t) {
    const legacy = typeof window !== "undefined" ? window.localStorage.getItem(ADMIN_TOKEN_KEY) : null;
    if (legacy) {
      s.setItem(ADMIN_TOKEN_KEY, legacy);
      const u = window.localStorage.getItem(ADMIN_USER_KEY);
      if (u) s.setItem(ADMIN_USER_KEY, u);
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.localStorage.removeItem(ADMIN_USER_KEY);
      t = legacy;
    }
  }
  return t;
}

export function setAdminSession(token: string, user: object) {
  const s = storage();
  if (!s) return;
  s.setItem(ADMIN_TOKEN_KEY, token);
  s.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_USER_KEY);
  }
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    window.sessionStorage.removeItem(ADMIN_USER_KEY);
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_USER_KEY);
  }
}

export function adminAuthHeaders(): Record<string, string> {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function getAdminUserDisplay(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const u = JSON.parse(s.getItem(ADMIN_USER_KEY) || "{}");
    return u?.name || u?.email || null;
  } catch {
    return null;
  }
}
