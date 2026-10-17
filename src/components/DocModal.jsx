import { useState } from "react";
import { ModalShell, Field } from "./ui.jsx";
import { safeUrl } from "../lib/format.js";

export default function DocModal({ link, onClose, onSave }) {
  const [name, setName] = useState(link?.name || "");
  const [url,  setUrl]  = useState(link?.url  || "");
  const [err,  setErr]  = useState({});
  const save = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required";
    if (!safeUrl(url)) e.url = "Enter a valid http(s) link";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ id: link?.id || Date.now(), name: name.trim(), url: safeUrl(url) });
  };
  return (
    <ModalShell title={link ? "Edit document" : "Add document"} subtitle="Enter a display name and a URL or file link" onClose={onClose}>
      <div className="modal-body">
        <Field label="Document name" required error={err.name}>
          <input type="text" value={name} onChange={e => { setName(e.target.value); setErr(v => ({ ...v, name: "" })); }}
            placeholder="e.g. Tenancy Agreement" className={`field${err.name ? " error" : ""}`} />
        </Field>
        <Field label="URL" required error={err.url}>
          <input type="url" value={url} onChange={e => { setUrl(e.target.value); setErr(v => ({ ...v, url: "" })); }}
            placeholder="https://…" className={`field${err.url ? " error" : ""}`} />
        </Field>
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="button" onClick={save} className="btn btn-primary"><i className="ti ti-check" />Save</button>
        </div>
      </div>
    </ModalShell>
  );
}
