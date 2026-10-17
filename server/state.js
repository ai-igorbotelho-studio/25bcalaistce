import { SEED_TASKS, INITIAL_LINKS } from "../src/seed.js";
import { DEFAULT_HEADER } from "../src/config.js";
import { extractImages } from "./images.js";
import { AppError } from "./http.js";

const MAX_STATE_BYTES = 1.5 * 1024 * 1024;   // D1 rows max out at 2 MB

export const toClient = (row) => ({
  state: JSON.parse(row.data),
  version: row.version,
  last_saved: row.last_saved,
  last_saved_by: row.last_saved_by,
});

export const readRow = (db) =>
  db.prepare("SELECT data, version, last_saved, last_saved_by FROM state WHERE id = 1").first();

/* ── Validation: a malformed task must never reach the database, or every
   viewer's page would crash. Unknown keys are kept (forward compatible). ── */
const str = (v, max = 5000) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function cleanComment(c) {
  if (!isObj(c)) return null;
  return { ...c, date: str(c.date, 40), author: str(c.author, 80), text: str(c.text, 5000), ...(c.image ? { image: str(c.image, 12_000_000) } : {}) };
}
function cleanLink(l) {
  if (!isObj(l)) return null;
  return { ...l, name: str(l.name, 200), url: str(l.url, 2000) };
}
function cleanTask(t) {
  if (!isObj(t) || (typeof t.id !== "number" && typeof t.id !== "string")) return null;
  return {
    ...t,
    title: str(t.title, 300), problem: str(t.problem, 10000),
    area: str(t.area, 40), space: str(t.space, 40), responsible: str(t.responsible, 40),
    status: str(t.status, 40), due: str(t.due, 10), image: str(t.image, 12_000_000),
    priority: t.priority === "High" ? "High" : "Low",
    comments: Array.isArray(t.comments) ? t.comments.map(cleanComment).filter(Boolean) : [],
    links: Array.isArray(t.links) ? t.links.map(cleanLink).filter(Boolean) : [],
  };
}

export function pickState(s = {}) {
  const h = isObj(s.header) ? s.header : DEFAULT_HEADER;
  return {
    tasks: Array.isArray(s.tasks) ? s.tasks.map(cleanTask).filter(Boolean) : [],
    header: { image: str(h.image, 12_000_000), title: str(h.title, 200), subtitle: str(h.subtitle, 200) },
    global_links: Array.isArray(s.global_links) ? s.global_links.map(cleanLink).filter(Boolean) : [],
  };
}

/* Last-edit-wins merging uses each task's updatedAt, which comes from the
   editor's device. A device clock running fast would win every later merge,
   so timestamps in the future are clamped to server time. */
export function clampFuture(tasks) {
  const now = new Date().toISOString();
  const clamp = (v) => (typeof v === "string" && v > now ? now : v);
  return tasks.map(t => ({
    ...t,
    updatedAt: clamp(t.updatedAt),
    comments: t.comments.map(c => ({ ...c, date: clamp(c.date) })),
  }));
}

/* One-time migration: the previous site kept everything in a Supabase
   row (property_data.id = 1). If the SUPABASE_SERVICE_ROLE_KEY secret is
   set, that row is imported on first load; otherwise we start from seed.
   If the import is configured but fails, nothing is written (503) so a
   transient error can't permanently replace the old data with the seed. */
async function initialState(env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    let r;
    try {
      r = await fetch(`${env.SUPABASE_URL}/rest/v1/property_data?id=eq.1&select=tasks,header,global_links`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
    } catch { throw new AppError(503, "Importing the old data failed — reload to retry."); }
    if (!r.ok) throw new AppError(503, `Importing the old data failed (${r.status}) — check SUPABASE_SERVICE_ROLE_KEY.`);
    const [row] = await r.json();
    if (row?.tasks?.length) return { state: pickState(row), by: "Imported from Supabase" };
  }
  return { state: pickState({ tasks: SEED_TASKS, header: DEFAULT_HEADER, global_links: INITIAL_LINKS }), by: null };
}

export async function ensureRow(env) {
  const row = await readRow(env.DB);
  if (row) return row;
  const { state, by } = await initialState(env);
  const clean = await extractImages(env.DB, state, by, { left: 500 });   // import may carry many photos
  await env.DB.prepare("INSERT OR IGNORE INTO state (id, data, version, last_saved, last_saved_by) VALUES (1, ?, 1, ?, ?)")
    .bind(JSON.stringify(clean), by ? new Date().toISOString() : null, by).run();
  return readRow(env.DB);
}

export function assertSize(json) {
  if (new TextEncoder().encode(json).length > MAX_STATE_BYTES) {
    throw new AppError(413, "The data is too large to save. Try shortening very long texts.");
  }
}
