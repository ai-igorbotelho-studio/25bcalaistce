/* Thin client for the Cloudflare Pages Functions in /functions/api. */
const SESSION_KEY = "calais-edit-session";

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s && s.token && s.exp > Date.now() ? s : null;
  } catch { return null; }
}
export function saveSession(s) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch {}
}

async function call(path, { method = "GET", body, token, keepalive = false } = {}) {
  const res = await fetch(path, {
    method, keepalive,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fetchState = () => call("/api/state");
export const login = (profile, password) => call("/api/login", { method: "POST", body: { profile, password } });
export const saveState = (token, payload, { keepalive = false } = {}) => call("/api/state", { method: "PUT", token, body: payload, keepalive });
export const postComment = (token, payload) => call("/api/comment", { method: "POST", token, body: payload });
