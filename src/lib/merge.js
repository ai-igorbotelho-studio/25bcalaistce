/* ════════════════════════════════════════════════════════════
   MERGE — keeps two people's edits when they save at the same time.
   All state lives in one Supabase row, so a plain upsert would let the
   last writer silently erase the other's changes. Before saving we
   re-read the row; if someone else saved since we loaded, we merge:
     • tasks    — per task, the most recently edited version wins;
                  comments from both sides are kept (union).
                  Deleting is a soft flag (`deleted: true`) so it merges too.
     • links    — union by id; links deleted in this session stay deleted.
     • header   — ours if we edited it this session, otherwise theirs.
   ════════════════════════════════════════════════════════════ */

const commentKey = (c) => `${c.date}|${c.author}|${c.text}`;

export function mergeComments(a = [], b = []) {
  const seen = new Map();
  [...a, ...b].forEach(c => { const k = commentKey(c); if (!seen.has(k)) seen.set(k, c); });
  return [...seen.values()].sort((x, y) => String(x.date).localeCompare(String(y.date)));
}

export function mergeTasks(local = [], remote = []) {
  const byId = new Map();
  remote.forEach(t => byId.set(t.id, t));
  local.forEach(t => {
    const r = byId.get(t.id);
    if (!r) { byId.set(t.id, t); return; }
    const newer = String(t.updatedAt || "") >= String(r.updatedAt || "") ? t : r;
    byId.set(t.id, { ...newer, comments: mergeComments(r.comments, t.comments) });
  });
  // keep the original ordering: remote order first, then local-only tasks
  const order = [...remote.map(t => t.id), ...local.map(t => t.id)];
  return [...new Set(order)].map(id => byId.get(id));
}

export function mergeLinks(local = [], remote = [], deletedIds = new Set()) {
  const byId = new Map();
  remote.forEach(l => { if (!deletedIds.has(l.id)) byId.set(l.id, l); });
  local.forEach(l => byId.set(l.id, l));
  const order = [...remote.map(l => l.id), ...local.map(l => l.id)];
  return [...new Set(order)].filter(id => byId.has(id)).map(id => byId.get(id));
}

export function mergeState(local, remote, { headerDirty = false, deletedLinkIds = new Set() } = {}) {
  return {
    tasks:  mergeTasks(local.tasks, remote.tasks || []),
    links:  mergeLinks(local.links, remote.global_links || [], deletedLinkIds),
    header: headerDirty || !remote.header ? local.header : remote.header,
  };
}
