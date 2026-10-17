/* POST /api/comment  { taskId, text, image?, clientId }  — EDIT mode only.
   Comments don't ride on the general autosave: each one is appended to the
   stored task directly, in one atomic, version-checked write, so it can't be
   lost to a race with someone else's save. The author comes from the sign-in
   token and the time from the server — the browser can't fake either.
   `clientId` makes retries safe: sending the same comment twice stores it once. */
import { verifyRequest } from "../../server/auth.js";
import { json, error, readBody, AppError } from "../../server/http.js";
import { extractImages } from "../../server/images.js";
import { ensureRow, readRow, toClient, assertSize } from "../../server/state.js";

const fail = (e) => (e instanceof AppError ? error(e.status, e.message) : (console.error(e), error(500, "Couldn't save the comment. Please try again.")));

export async function onRequestPost({ env, request }) {
  if (!env.DB) return error(500, "Database binding DB is missing.");
  const profile = await verifyRequest(env, request);
  if (!profile) return error(401, "Your edit session has expired. Tap EDIT to sign in again — your comment is kept.");

  const body = await readBody(request);
  if (!body) return error(400, "Invalid JSON.");
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 5000) : "";
  const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 64) : "";
  if (!text && !image) return error(400, "Write a comment or add a photo.");

  try {
    // Store the photo first (content-addressed, so a retry reuses it).
    const imageUrl = image ? await extractImages(env.DB, image, profile) : "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await ensureRow(env);
      const data = JSON.parse(current.data);
      const task = (data.tasks || []).find(t => String(t.id) === String(body.taskId) && !t.deleted);
      if (!task) return error(404, "That task no longer exists.");
      task.comments = Array.isArray(task.comments) ? task.comments : [];

      if (clientId && task.comments.some(c => c.id === clientId)) {
        return json({ ...toClient(current), duplicate: true });   // already saved by an earlier try
      }
      const comment = {
        id: clientId || crypto.randomUUID(),
        date: new Date().toISOString(),
        author: profile,
        text,
        ...(imageUrl ? { image: imageUrl } : {}),
      };
      task.comments.push(comment);

      const out = JSON.stringify(data);
      assertSize(out);
      const res = await env.DB.prepare(
        "UPDATE state SET data = ?, version = version + 1, last_saved = ?, last_saved_by = ? WHERE id = 1 AND version = ?",
      ).bind(out, comment.date, profile, current.version).run();
      if (res.meta.changes === 1) return json({ ...toClient(await readRow(env.DB)), comment });
      // someone saved in between → re-read and append again
    }
    return error(409, "Too many people saving at once — please try again.");
  } catch (e) {
    return fail(e);
  }
}
