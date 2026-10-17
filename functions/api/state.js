/* GET  /api/state — public, read-only snapshot of all tasks.
   PUT  /api/state — EDIT mode only (Bearer token). Body:
        { state: { tasks, header, global_links }, baseVersion,
          meta: { headerDirty, deletedLinkIds } }
   If someone else saved since `baseVersion`, the two versions are merged
   (see src/lib/merge.js) instead of overwriting each other. */
import { verifyRequest } from "../../server/auth.js";
import { json, error, readBody, AppError } from "../../server/http.js";
import { extractImages } from "../../server/images.js";
import { ensureRow, readRow, pickState, toClient, assertSize, clampFuture } from "../../server/state.js";
import { mergeState } from "../../src/lib/merge.js";
import { HEADER_EDITORS } from "../../src/config.js";

const fail = (e) => (e instanceof AppError ? error(e.status, e.message) : (console.error(e), error(500, "Something went wrong on the server. Please try again.")));

export async function onRequestGet({ env }) {
  if (!env.DB) return error(500, "Database binding DB is missing.");
  try { return json(toClient(await ensureRow(env))); } catch (e) { return fail(e); }
}

export async function onRequestPut({ env, request }) {
  if (!env.DB) return error(500, "Database binding DB is missing.");
  const profile = await verifyRequest(env, request);
  if (!profile) return error(401, "Your edit session has expired. Tap EDIT to sign in again.");

  const body = await readBody(request);
  if (!body) return error(400, "Invalid JSON.");
  const incoming = pickState(body.state);
  const meta = body.meta || {};

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await ensureRow(env);
      const remote = JSON.parse(current.data);
      let next = { ...incoming, tasks: clampFuture(incoming.tasks) };
      let merged = false;
      if (current.version !== body.baseVersion) {
        const m = mergeState(
          { tasks: next.tasks, links: next.global_links, header: next.header },
          remote,
          { headerDirty: !!meta.headerDirty, deletedLinkIds: new Set(Array.isArray(meta.deletedLinkIds) ? meta.deletedLinkIds : []) },
        );
        next = { tasks: m.tasks, header: m.header, global_links: m.links };
        merged = true;
      }
      if (!HEADER_EDITORS.includes(profile)) next.header = remote.header;   // header is Flavia/Igor only

      const clean = await extractImages(env.DB, next, profile);
      const data = JSON.stringify(clean);
      assertSize(data);
      const now = new Date().toISOString();
      const res = await env.DB.prepare(
        "UPDATE state SET data = ?, version = version + 1, last_saved = ?, last_saved_by = ? WHERE id = 1 AND version = ?",
      ).bind(data, now, profile, current.version).run();
      if (res.meta.changes === 1) {
        return json({ ...toClient(await readRow(env.DB)), merged });
      }
      // someone saved between our read and write → loop, re-read and merge again
    }
    return error(409, "Too many people saving at once — please try again.");
  } catch (e) {
    return fail(e);
  }
}
