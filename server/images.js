import { AppError } from "./http.js";

/* ════════════════════════════════════════════════════════════
   Photos are uploaded inside the state as data: URLs (that is what
   the browser produces after downscaling). Before saving, every
   data:image URL is moved into the D1 `images` table and replaced by
   a short /api/img/<id> URL. The id is a content hash, so the same
   photo is only ever stored once.
   ════════════════════════════════════════════════════════════ */
const CHUNK = 900 * 1024;                 // keep each D1 row well under 2 MB
const MAX_IMAGE = 8 * 1024 * 1024;        // 8 MB decoded, per photo
const MAX_NEW_PER_SAVE = 12;              // D1 allows ~50 queries per request on the free plan
const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/;

const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

function decode(b64) {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function storeImage(db, mime, bytes, by, budget) {
  const id = hex(await crypto.subtle.digest("SHA-256", bytes)).slice(0, 32);
  const exists = await db.prepare("SELECT 1 FROM images WHERE id = ? LIMIT 1").bind(id).first();
  if (!exists) {
    if (--budget.left < 0) throw new AppError(413, `Too many new photos in one save (max ${MAX_NEW_PER_SAVE}). Add the rest in a moment.`);
    const now = new Date().toISOString();
    const stmts = [];
    for (let seq = 0, off = 0; off < bytes.length; seq++, off += CHUNK) {
      stmts.push(db.prepare("INSERT OR IGNORE INTO images (id, seq, mime, data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, seq, mime, bytes.slice(off, off + CHUNK).buffer, now, by || null));
    }
    await db.batch(stmts);
  }
  return `/api/img/${id}`;
}

/* Walks any JSON value and returns a copy with data:image URLs extracted.
   Sequential on purpose: keeps the number of concurrent D1 queries low. */
export async function extractImages(db, value, by, budget = { left: MAX_NEW_PER_SAVE }) {
  if (typeof value === "string") {
    if (!value.startsWith("data:")) return value;
    const m = DATA_URL.exec(value);
    if (!m) return "";                       // unsupported data: URL → dropped
    const bytes = decode(m[2]);
    if (bytes.length > MAX_IMAGE) throw new AppError(413, "A photo is larger than 8 MB.");
    return storeImage(db, m[1], bytes, by, budget);
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await extractImages(db, v, by, budget));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await extractImages(db, v, by, budget);
    return out;
  }
  return value;
}

export async function loadImage(db, id) {
  const { results } = await db.prepare("SELECT mime, data FROM images WHERE id = ? ORDER BY seq").bind(id).all();
  if (!results.length) return null;
  const parts = results.map(r => (r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : Uint8Array.from(r.data)));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { bytes.set(p, off); off += p.length; }
  return { mime: results[0].mime, bytes };
}
