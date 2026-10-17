/* POST /api/login  { profile: "Sarah", password } → { token, profile, exp }
   Brute-force throttle: 10 failed attempts per IP per 15 minutes (D1 table
   login_attempts). For stronger protection add a Cloudflare WAF rate-limit
   rule on /api/login — see docs/DEPLOY-CLOUDFLARE.md. */
import { checkPassword, issueToken, normaliseProfile } from "../../server/auth.js";
import { json, error, readBody } from "../../server/http.js";

const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function onRequestPost({ env, request }) {
  if (!env.EDIT_PASSWORD) return error(503, "Editing is not configured yet (EDIT_PASSWORD secret missing).");
  const body = await readBody(request);
  if (!body) return error(400, "Invalid JSON.");
  const profile = normaliseProfile(body.profile);
  if (!profile) return error(400, "Choose a profile.");

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const row = env.DB ? await env.DB.prepare("SELECT count, window_start FROM login_attempts WHERE ip = ?").bind(ip).first() : null;
  const active = row && now - row.window_start < WINDOW_MS;
  if (active && row.count >= MAX_FAILS) {
    const mins = Math.ceil((row.window_start + WINDOW_MS - now) / 60000);
    return error(429, `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  if (!(await checkPassword(env, String(body.password || "")))) {
    if (env.DB) {
      await env.DB.prepare(active
        ? "UPDATE login_attempts SET count = count + 1 WHERE ip = ?1"
        : "INSERT INTO login_attempts (ip, count, window_start) VALUES (?1, 1, ?2) ON CONFLICT(ip) DO UPDATE SET count = 1, window_start = ?2")
        .bind(...(active ? [ip] : [ip, now])).run();
    }
    await new Promise(r => setTimeout(r, 600));
    return error(401, "Wrong password.");
  }
  if (row && env.DB) await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
  const { token, exp } = await issueToken(env, profile);
  return json({ token, profile, exp });
}
