import { useState } from "react";
import { ModalShell, Field, ToggleGroup, ToggleBtn, PrioritySwitch, ConfirmDialog } from "./ui.jsx";
import { AREAS, SPACES, RESPONSIBLE, STATUSES, AREA_STYLE, RESP_STYLE, STATUS_STYLE, SPACE_STYLE, IMG_MAX, DEFAULT_PRIORITY, taskPriority } from "../config.js";
import { fileToDownscaledDataURL } from "../lib/images.js";
import { safeUrl } from "../lib/format.js";

const EMPTY = { title:"", problem:"", area:"Indoor", space:"Kitchen", responsible:"Tenant", status:"To Do",
  priority: DEFAULT_PRIORITY, due:"", image:"", comments:[], links:[] };

export default function TaskModal({ task, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(task ? { ...EMPTY, ...task, priority: taskPriority(task) } : EMPTY);
  const [linkName, setLinkName] = useState("");
  const [linkUrl,  setLinkUrl]  = useState("");
  const [errors,   setErrors]   = useState({});
  const [imgBusy,  setImgBusy]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim())   e.title   = "Title is required";
    if (!form.problem.trim()) e.problem = "Problem description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const pickImage = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setImgBusy(true);
    try { set("image", await fileToDownscaledDataURL(f, IMG_MAX.task)); } catch (_) {}
    setImgBusy(false);
    e.target.value = "";
  };
  const addLink = () => {
    const url = safeUrl(linkUrl);
    if (!linkName.trim() || !url) { setErrors(er => ({ ...er, link: "Enter a name and a valid http(s) link" })); return; }
    set("links", [...form.links, { name: linkName.trim(), url }]);
    setLinkName(""); setLinkUrl(""); setErrors(er => ({ ...er, link: "" }));
  };

  return (
    <ModalShell title={task ? "Edit task" : "New task"} subtitle="Fill in the fields and save when ready" onClose={onClose}>
      <div className="modal-body">
        <div className="section-label">Priority</div>
        <PrioritySwitch value={form.priority} onChange={v => set("priority", v)} size="lg" />

        <div className="section-label">Task details</div>
        <Field label="Title" required error={errors.title}>
          <input type="text" value={form.title} placeholder="e.g. Leaking roof gutter"
            onChange={e => { set("title", e.target.value); setErrors(er => ({ ...er, title: "" })); }}
            className={`field${errors.title ? " error" : ""}`} />
        </Field>
        <Field label="What needs to be resolved" required error={errors.problem}>
          <textarea value={form.problem} rows={4}
            placeholder="Describe the issue clearly — what is happening, where, and how urgent it is…"
            onChange={e => { set("problem", e.target.value); setErrors(er => ({ ...er, problem: "" })); }}
            className={`field${errors.problem ? " error" : ""}`} />
        </Field>
        <Field label="Due date">
          <input type="date" value={form.due || ""} onChange={e => set("due", e.target.value)} className="field field-date" />
        </Field>

        <div className="section-label">Photo</div>
        {form.image && (
          <div className="photo-preview">
            <img src={form.image} alt="" />
            <button type="button" onClick={() => set("image", "")} aria-label="Remove photo"><i className="ti ti-x" /></button>
          </div>
        )}
        <label className="upload-box">
          <i className={`ti ti-${imgBusy ? "loader-2 spin" : "camera"}`} />
          {imgBusy ? "Processing…" : form.image ? "Replace photo" : "Upload photo from device"}
          <input type="file" accept="image/*" hidden onChange={pickImage} />
        </label>

        <div className="section-label">Classification</div>
        <ToggleGroup label="Area" options={AREAS.slice(1)} value={form.area} onChange={v => set("area", v)} styleMap={AREA_STYLE} />
        <div className="stack-6" role="group" aria-label="Space">
          <div className="section-label plain">Space</div>
          <div className="wrap-6">
            {SPACES.slice(1).map(o => (
              <ToggleBtn key={o} label={o} active={form.space === o}
                bg={SPACE_STYLE.bg} color={SPACE_STYLE.color} border={SPACE_STYLE.border} onClick={() => set("space", o)} />
            ))}
          </div>
        </div>
        <ToggleGroup label="Responsible" options={RESPONSIBLE.slice(1)} value={form.responsible} onChange={v => set("responsible", v)} styleMap={RESP_STYLE} />
        <ToggleGroup label="Status" options={STATUSES.slice(1)} value={form.status} onChange={v => set("status", v)} styleMap={STATUS_STYLE} />

        <div className="section-label">Relevant links</div>
        {form.links.map((l, i) => (
          <div key={i} className="link-row">
            <i className="ti ti-link" />
            <span>{l.name}</span>
            <button type="button" onClick={() => set("links", form.links.filter((_, j) => j !== i))} aria-label={`Remove link ${l.name}`}><i className="ti ti-trash" /></button>
          </div>
        ))}
        <div className="link-add">
          <input placeholder="Link name" value={linkName} onChange={e => setLinkName(e.target.value)} className="field" aria-label="Link name" />
          <input placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="field" aria-label="Link URL" />
        </div>
        {errors.link && <span className="form-error">{errors.link}</span>}
        <button type="button" onClick={addLink} className="btn btn-sm self-start"><i className="ti ti-plus" />Add link</button>

        <div className="modal-actions">
          {task && onDelete && (
            <button type="button" className="btn btn-danger-ghost mr-auto" onClick={() => setConfirmDel(true)}>
              <i className="ti ti-trash" />Delete task
            </button>
          )}
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="button" onClick={() => { if (validate()) onSave(form); }} className="btn btn-primary">
            <i className="ti ti-check" />Save task
          </button>
        </div>
      </div>
      {confirmDel && (
        <ConfirmDialog title="Delete this task?" message={`“${task.title}” will be removed from the list for everyone.`}
          onCancel={() => setConfirmDel(false)} onConfirm={() => { setConfirmDel(false); onDelete(task); }} />
      )}
    </ModalShell>
  );
}
