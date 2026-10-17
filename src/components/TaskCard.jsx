import { useState, useEffect, useRef } from "react";
import { Badge, PrioritySwitch, StatusPicker } from "./ui.jsx";
import { AREA_STYLE, RESP_STYLE, SPACE_STYLE, STATUS_STYLE, STATUSES, OVERDUE_STYLE, IMG_MAX, taskPriority } from "../config.js";
import { fmtDate, fmtDateTime, isOverdue, safeUrl } from "../lib/format.js";
import { fileToDownscaledDataURL } from "../lib/images.js";

function Badges({ task }) {
  return (
    <div className="wrap-6">
      <Badge label={task.area}        style={AREA_STYLE[task.area] || AREA_STYLE.Indoor} />
      <Badge label={task.space}       style={SPACE_STYLE} />
      <Badge label={task.responsible} style={RESP_STYLE[task.responsible] || RESP_STYLE.Tenant} />
      {isOverdue(task) && <Badge label="Overdue" style={OVERDUE_STYLE} />}
    </div>
  );
}

/* Unsent comment drafts are kept in this browser until they're saved,
   so closing the tab or losing connection never throws away typing. */
const draftKey = (id) => `calais-comment-draft-${id}`;
const loadDraft = (id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || "null"); } catch { return null; } };
const storeDraft = (id, d) => {
  try { d && (d.text || d.image) ? localStorage.setItem(draftKey(id), JSON.stringify(d)) : localStorage.removeItem(draftKey(id)); }
  catch { /* storage full (large photo) — the draft still lives in memory */ }
};
const newClientId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function TaskCard({ task, editing, editorName, onEdit, onEditOpen, onRequestEdit, onOpenImage, onMoved, onComment }) {
  const saved = useRef(loadDraft(task.id)).current;
  const [expanded, setExpanded] = useState(!!saved);
  const [composing, setComposing] = useState(!!saved);
  const [newComment, setNewComment] = useState(saved?.text || "");
  const [newImg, setNewImg] = useState(saved?.image || "");
  const [clientId, setClientId] = useState(saved?.clientId || newClientId());
  const [imgBusy, setImgBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const textRef = useRef(null);

  // keep the draft in localStorage while typing
  useEffect(() => { storeDraft(task.id, { text: newComment, image: newImg, clientId }); }, [newComment, newImg, clientId]);
  const priority = taskPriority(task);
  const comments = task.comments || [];
  const links = task.links || [];

  const pickCommentImg = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setImgBusy(true);
    try { setNewImg(await fileToDownscaledDataURL(f, IMG_MAX.comment)); } catch (_) {}
    setImgBusy(false);
    e.target.value = "";
  };
  const openComposer = () => {
    if (!editing) { onRequestEdit(); return; }
    setExpanded(true); setComposing(true); setJustSaved(false);
    setTimeout(() => textRef.current?.focus(), 30);
  };
  const cancelComposer = () => {
    setComposing(false); setNewComment(""); setNewImg(""); setSendError(null); setClientId(newClientId());
  };
  const saveComment = async () => {
    if (sending || (!newComment.trim() && !newImg)) return;
    setSending(true); setSendError(null);
    try {
      await onComment(task.id, newComment.trim(), newImg, clientId);
      // only now is it safe to clear the draft
      setNewComment(""); setNewImg(""); setClientId(newClientId());
      setComposing(false); setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
    } catch (e) {
      setSendError(e.status === 401
        ? "Your session expired — sign in again and tap Save. Your comment is kept."
        : !e.status
          ? "No connection — not saved yet. Your comment is kept; tap Save again when you're back online."
          : `${e.message || "Couldn't save."} Your comment is kept — tap Save to try again.`);
    } finally {
      setSending(false);
    }
  };
  const setPriority = (p) => {
    if (!editing) { onRequestEdit(); return; }
    if (p === priority) return;
    onEdit(task.id, { priority: p });
    onMoved?.(task, task.status === "Completed" ? "Completed" : `${p.toUpperCase()} priority`);
  };
  const setStatus = (st) => {
    if (!editing) { onRequestEdit(); return; }
    if (st === task.status) return;
    onEdit(task.id, { status: st });
    if (st === "Completed") onMoved?.(task, "Completed");
    else if (task.status === "Completed") onMoved?.(task, `${priority.toUpperCase()} priority`);
  };

  return (
    <article className={`task-card prio-card-${priority.toLowerCase()}${task.status === "Completed" ? " is-done" : ""}`} id={`task-${task.id}`}>
      {task.image ? (
        <button type="button" className="task-img" onClick={() => onOpenImage(task.image, task.title)} aria-label={`Enlarge photo: ${task.title}`}>
          <img src={task.image} alt={task.title} loading="lazy" decoding="async" />
          <div className="task-img-badges"><Badges task={task} /></div>
        </button>
      ) : (
        <div className="task-badges-plain"><Badges task={task} /></div>
      )}

      <div className="task-body">
        <div className="card-controls">
          <PrioritySwitch value={priority} onChange={setPriority} size="sm" locked={!editing} label={`Priority for ${task.title}`} />
          <StatusPicker value={task.status} options={STATUSES.slice(1)} styles={STATUS_STYLE}
            onChange={setStatus} locked={!editing} label={`Status for ${task.title}`} />
        </div>

        <div className="task-title-row">
          <h3>{task.title}</h3>
          <div className="task-meta">
            {task.due && <span className={`due${isOverdue(task) ? " overdue" : ""}`}>Due {fmtDate(task.due)}</span>}
            {editing && (
              <button type="button" onClick={() => onEditOpen(task)} aria-label={`Edit task: ${task.title}`} className="btn-xs">
                <i className="ti ti-pencil" /> Edit
              </button>
            )}
          </div>
        </div>
        <p className="task-problem">{task.problem}</p>

        {links.length > 0 && (
          <div className="wrap-6">
            {links.map((l, i) => safeUrl(l.url) && (
              <a key={i} href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="task-link">
                <i className="ti ti-external-link" />{l.name}
              </a>
            ))}
          </div>
        )}
        {task.updatedBy && (
          <span className="task-updated">Last edited by {task.updatedBy}{task.updatedAt ? " · " + fmtDateTime(task.updatedAt) : ""}</span>
        )}

        <div className="comments-bar">
          <button type="button" onClick={() => setExpanded(e => !e)} className="comments-toggle" aria-expanded={expanded}>
            <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} />
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </button>
          {justSaved && <span className="comment-saved" role="status"><i className="ti ti-circle-check" /> Comment saved</span>}
          {!composing && (
            <button type="button" className="btn-comment" onClick={openComposer}>
              <i className="ti ti-message-plus" /> Comment
            </button>
          )}
        </div>

        {expanded && (
          <div className="comments">
            {comments.length === 0 && !composing && <p className="muted small">No comments yet.</p>}
            {comments.map((c, i) => (
              <div key={c.id || i} className="comment">
                <div className="comment-head"><b>{c.author}</b><span>{fmtDateTime(c.date)}</span></div>
                {c.text && <p>{c.text}</p>}
                {c.image && (
                  <button type="button" className="comment-img" onClick={() => onOpenImage(c.image, `Photo from ${c.author}`)}>
                    <img src={c.image} alt={`Photo from ${c.author}`} loading="lazy" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {composing && (
          <div className="composer">
            <div className="muted small">
              {editing ? <>Commenting as <b>{editorName}</b></> : <>Draft kept — tap <b>EDIT</b> to sign in and save it</>}
            </div>
            <textarea ref={textRef} value={newComment} onChange={e => { setNewComment(e.target.value); setSendError(null); }}
              placeholder="Write a comment…" rows={3} className="field" aria-label={`New comment on ${task.title}`}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveComment(); }} disabled={sending} />
            {newImg && (
              <div className="thumb">
                <img src={newImg} alt="Attached photo" />
                <button type="button" onClick={() => setNewImg("")} aria-label="Remove photo" disabled={sending}><i className="ti ti-x" /></button>
              </div>
            )}
            {sendError && <p className="form-error" role="alert">{sendError}</p>}
            <div className="row-between">
              <label className="link-btn">
                <i className={`ti ti-${imgBusy ? "loader-2 spin" : "camera-plus"}`} />
                {imgBusy ? "Adding…" : "Add photo"}
                <input type="file" accept="image/*" hidden onChange={pickCommentImg} disabled={sending} />
              </label>
              <div className="composer-actions">
                <button type="button" onClick={cancelComposer} className="btn btn-sm" disabled={sending}>Cancel</button>
                <button type="button" onClick={editing ? saveComment : onRequestEdit} className="btn btn-sm btn-primary"
                  disabled={sending || imgBusy || (!newComment.trim() && !newImg)}>
                  <i className={`ti ti-${sending ? "loader-2 spin" : "device-floppy"}`} />{sending ? "Saving…" : "Save comment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
