import { useState } from "react";
import { ModalShell, Field } from "./ui.jsx";
import { IMG_MAX } from "../config.js";
import { fileToDownscaledDataURL } from "../lib/images.js";

export default function HeaderModal({ header, onClose, onSave }) {
  const [draft, setDraft] = useState(header);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try { const image = await fileToDownscaledDataURL(f, IMG_MAX.header, 0.82); setDraft(d => ({ ...d, image })); } catch (_) {}
    setBusy(false);
    e.target.value = "";
  };
  return (
    <ModalShell title="Edit header" subtitle="Update the property photo and address details" onClose={onClose}>
      <div className="modal-body">
        <div className="section-label">Header photo</div>
        {draft.image && (
          <div className="photo-preview">
            <img src={draft.image} alt="" />
            <button type="button" onClick={() => setDraft(d => ({ ...d, image: "" }))} aria-label="Remove photo"><i className="ti ti-x" /></button>
          </div>
        )}
        <label className="upload-box">
          <i className={`ti ti-${busy ? "loader-2 spin" : "camera"}`} />
          {busy ? "Processing…" : draft.image ? "Replace photo" : "Upload photo from device"}
          <input type="file" accept="image/*" hidden onChange={pick} />
        </label>
        <Field label="Property name / address">
          <input type="text" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="e.g. 25B Calais Terrace, Ostend" className="field" />
        </Field>
        <Field label="Suburb / city / postcode">
          <input type="text" value={draft.subtitle} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))}
            placeholder="e.g. Waiheke Island — Auckland — 1081" className="field" />
        </Field>
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} className="btn btn-primary"><i className="ti ti-check" />Save header</button>
        </div>
      </div>
    </ModalShell>
  );
}
