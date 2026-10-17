import { useState } from "react";
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

export default function TaskCard({ task, editing, editorName, onEdit, onEditOpen, onRequestEdit, onOpenImage, onMoved }) {
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newImg, setNewImg] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
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
  const postComment = () => {
    if (!newComment.trim() && !newImg) return;
    onEdit(task.id, { comments: [...comments, {
      date: new Date().toISOString(), author: editorName,
      text: newComment.trim(), ...(newImg ? { image: newImg } : {}),
    }]});
    setNewComment(""); setNewImg("");
  };
  const setPriority = (p) => {
    if (!editing) { onRequestEdit(); return; }
    if (p === priority) return;
    onEdit(task.id, { priority: p });
    onMoved?.(task, p);
  };
  const setStatus = (st) => {
    if (!editing) { onRequestEdit(); return; }
    if (st !== task.status) onEdit(task.id, { status: st });
  };

  return (
    <article className={`task-card prio-card-${priority.toLowerCase()}`} id={`task-${task.id}`}>
      {task.image ? (
        <button type="button" className="task-img" onClick={() => onOpenImage(task.image, task.title)} aria-label={`Enlarge photo: ${task.title}`}>
          <img src={task.image} alt={task.title} loading="lazy" decoding="async" />
          <div className="task-img-badges"><Badges task={task} /></div>
        </button>
      ) : (
        <div className="task-badges-plain"><Badges task={task} /></div>
      )}

      <div className="task-body">
        <PrioritySwitch value={priority} onChange={setPriority} size="sm" locked={!editing} label={`Priority for ${task.title}`} />
        <StatusPicker value={task.status} options={STATUSES.slice(1)} styles={STATUS_STYLE}
          onChange={setStatus} locked={!editing} label={`Status for ${task.title}`} />

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

        <button type="button" onClick={() => setExpanded(e => !e)} className="comments-toggle" aria-expanded={expanded}>
          <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} />
          {comments.length} comment{comments.length !== 1 ? "s" : ""}
        </button>

        {expanded && (
          <div className="comments">
            {comments.length === 0 && <p className="muted small">No comments yet.</p>}
            {comments.map((c, i) => (
              <div key={i} className="comment">
                <div className="comment-head"><b>{c.author}</b><span>{fmtDateTime(c.date)}</span></div>
                {c.text && <p>{c.text}</p>}
                {c.image && (
                  <button type="button" className="comment-img" onClick={() => onOpenImage(c.image, `Photo from ${c.author}`)}>
                    <img src={c.image} alt={`Photo from ${c.author}`} loading="lazy" />
                  </button>
                )}
              </div>
            ))}

            {editing ? (
              <>
                <div className="muted small">Commenting as <b>{editorName}</b></div>
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment…" rows={2} className="field" aria-label="New comment" />
                {newImg && (
                  <div className="thumb">
                    <img src={newImg} alt="Attached photo" />
                    <button type="button" onClick={() => setNewImg("")} aria-label="Remove photo"><i className="ti ti-x" /></button>
                  </div>
                )}
                <div className="row-between">
                  <label className="link-btn">
                    <i className={`ti ti-${imgBusy ? "loader-2 spin" : "camera-plus"}`} />
                    {imgBusy ? "Adding…" : "Add photo"}
                    <input type="file" accept="image/*" hidden onChange={pickCommentImg} />
                  </label>
                  <button type="button" onClick={postComment} className="btn btn-primary btn-sm">Post comment</button>
                </div>
              </>
            ) : (
              <button type="button" className="link-btn" onClick={onRequestEdit}>
                <i className="ti ti-lock-open" /> Tap EDIT to add a comment
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
