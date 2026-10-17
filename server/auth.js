/* ════════════════════════════════════════════════════════════
   EDIT sessions — stateless signed tokens.
   token = base64url({ p: profile, exp }) + "." + HMAC-SHA256(payload)
   The HMAC key is the SESSION_SECRET secret when set (recommended: a long
   random string), combined with EDIT_PASSWORD — so changing the password
   instantly signs everyone out.
   ════════════════════════════════════════════════════════════ */
import { PROFILES } from "../src/config.js";

const enc = new TextEncoder();
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/* Constant-time string compare (both sides hashed first so lengths match). */
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest("SHA-256", enc.encode(String(s)))));
  const ax = new Uint8Array(x), ay = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ ay[i];
  return diff === 0;
}

const signingKey = (env) => `${env.SESSION_SECRET || ""}|${env.EDIT_PASSWORD}|25bcalais-session-v1`;

export const normaliseProfile = (p) =>
  PROFILES.find(x => x.toLowerCase() === String(p || "").trim().toLowerCase()) || null;

export async function checkPassword(env, password) {
  if (!env.EDIT_PASSWORD) return false;           // not configured → nobody can edit
  return safeEqual(password, env.EDIT_PASSWORD);
}

export async function issueToken(env, profile) {
  const exp = Date.now() + TTL_MS;
  const payload = b64url(enc.encode(JSON.stringify({ p: profile, exp })));
  return { token: `${payload}.${await hmac(signingKey(env), payload)}`, exp };
}

/* Returns the profile name for a valid Bearer token, or null. */
export async function verifyRequest(env, request) {
  if (!env.EDIT_PASSWORD) return null;
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") || "");
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  if (!(await safeEqual(sig, await hmac(signingKey(env), payload)))) return null;
  try {
    const { p, exp } = JSON.parse(fromB64url(payload));
    if (typeof exp !== "number" || exp < Date.now()) return null;
    return normaliseProfile(p);
  } catch { return null; }
}
