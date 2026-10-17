import { useMemo, useState } from "react";
import { ModalShell } from "./ui.jsx";
import { AREAS, SPACES, RESPONSIBLE, STATUSES } from "../config.js";
import { applyExportFilters, exportExcel, exportPDF } from "../lib/export.js";

/* Defined outside the modal so selects keep focus while typing/choosing. */
function Selector({ label, value, set, options }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <select value={value} onChange={e => set(e.target.value)} className="field">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function ExportModal({ tasks, currentFilters, exportedBy, onClose }) {
  const [from, setFrom] = useState("");
  const [to,   setTo]   = useState("");
  const [area,        setArea]        = useState(currentFilters.area);
  const [space,       setSpace]       = useState(currentFilters.space);
  const [responsible, setResponsible] = useState(currentFilters.responsible);
  const [status,      setStatus]      = useState(currentFilters.status);
  const [busy, setBusy] = useState(false);

  const opts = { from, to, area, space, responsible, status };
  const result = useMemo(() => applyExportFilters(tasks, opts), [tasks, from, to, area, space, responsible, status]);
  const none = result.length === 0;

  const xlsx = async () => { setBusy(true); try { await exportExcel(result, opts, exportedBy); } finally { setBusy(false); } };

  return (
    <ModalShell title="Export tasks" subtitle="Choose a date range and filters, then export as PDF or Excel" onClose={onClose}>
      <div className="modal-body">
        <div className="section-label">Due-date range</div>
        <div className="grid2">
          <label className="form-field"><span className="form-label">From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="field" /></label>
          <label className="form-field"><span className="form-label">To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field" /></label>
        </div>
        <p className="form-hint">Leave both blank to include every date. Tasks without a due date are excluded when a range is set.</p>

        <div className="section-label">Filters to include</div>
        <div className="grid2">
          <Selector label="Area"        value={area}        set={setArea}        options={AREAS} />
          <Selector label="Space"       value={space}       set={setSpace}       options={SPACES} />
          <Selector label="Responsible" value={responsible} set={setResponsible} options={RESPONSIBLE} />
          <Selector label="Status"      value={status}      set={setStatus}      options={STATUSES} />
        </div>
        <div className="note"><b>{result.length}</b> task{result.length !== 1 ? "s" : ""} match and will be exported.</div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="button" onClick={() => exportPDF(result, opts, exportedBy)} disabled={none} className="btn">
            <i className="ti ti-file-type-pdf" />Export PDF
          </button>
          <button type="button" onClick={xlsx} disabled={none || busy} className="btn btn-primary">
            <i className={`ti ti-${busy ? "loader-2 spin" : "file-type-xls"}`} />Export Excel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
