import { useEffect, useRef } from "react";

export function Badge({ label, style, title }) {
  return (
    <span className="badge" title={title}
      style={{ borderColor: style.border, background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

export function Pill({ label, active, onClick }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`pill${active ? " active" : ""}`}>{label}</button>;
}

export function ToggleBtn({ label, active, bg, color, border, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`toggle-btn${active ? " active" : ""}`}
      style={active ? { background: bg, color } : {}}>
      {label}
    </button>
  );
}

export function ToggleGroup({ label, options, value, onChange, styleMap }) {
  return (
    <div className="stack-6" role="group" aria-label={label}>
      <div className="section-label plain">{label}</div>
      <div className="wrap-6">
        {options.map(o => {
          const s = styleMap?.[o] || { bg:"#F1EFE8", color:"#5F5E5A", border:"#B4B2A9" };
          return <ToggleBtn key={o} label={o} active={value === o} bg={s.bg} color={s.color} border={s.border} onClick={() => onChange(o)} />;
        })}
      </div>
    </div>
  );
}

/* Shared modal shell: Escape / backdrop click closes, focus moves inside. */
export function ModalShell({ title, subtitle, onClose, children, maxWidth = 560, icon }) {
  const boxRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const focusables = () => [...boxRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea')]
      .filter(el => el.offsetParent !== null);
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !boxRef.current?.contains(document.activeElement)) return;
      const els = focusables(); if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    boxRef.current.addEventListener("keydown", onKey);
    const box = boxRef.current;
    const start = box.querySelector("[data-autofocus]") || box.querySelector("input, textarea, select, button:not(.modal-close)");
    start?.focus({ preventScroll: true });
    document.body.classList.add("modal-open");
    return () => {
      box.removeEventListener("keydown", onKey);
      if (!document.querySelector(".modal-box")) document.body.classList.remove("modal-open");
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={title} ref={boxRef} style={{ maxWidth }}>
        <div className="modal-head">
          <div>
            <h2>{icon && <i className={`ti ti-${icon}`} aria-hidden="true" />} {title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="modal-close"><i className="ti ti-x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, error, children, hint }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}{required && <span className="req"> *</span>}</span>
      {children}
      {error && <span className="form-error">{error}</span>}
      {hint && <span className="form-hint">{hint}</span>}
    </label>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", onCancel, onConfirm }) {
  return (
    <ModalShell title={title} onClose={onCancel} maxWidth={380} icon="alert-triangle">
      <div className="modal-body">
        <p className="muted">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* HIGH | LOW segmented control used on every card and in the task form. */
export function PrioritySwitch({ value, onChange, size = "md", locked, label = "Priority" }) {
  return (
    <div className={`prio-switch prio-${size}${locked ? " locked" : ""}`} role="group" aria-label={label}>
      {["High", "Low"].map(p => (
        <button key={p} type="button" aria-pressed={value === p}
          className={`prio-opt prio-${p.toLowerCase()}${value === p ? " on" : ""}`}
          title={locked ? "Tap EDIT to change priority" : `Set ${p.toUpperCase()} priority`}
          onClick={() => onChange(p)}>
          {p === "High" && <i className="ti ti-flame" aria-hidden="true" />}
          {p === "Low" && <i className="ti ti-leaf" aria-hidden="true" />}
          {p.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* Status buttons on every card: To Do · Planned · In Progress · Completed. */
const STATUS_ICON = { "To Do": "circle", "Planned": "calendar", "In Progress": "progress", "Completed": "circle-check" };
export function StatusPicker({ value, options, styles, onChange, locked, label = "Status" }) {
  return (
    <div className={`status-picker${locked ? " locked" : ""}`} role="group" aria-label={label}>
      {options.map(o => {
        const on = value === o, st = styles[o];
        return (
          <button key={o} type="button" aria-pressed={on} className={`status-opt${on ? " on" : ""}`}
            style={on ? { background: st.bg, color: st.color } : undefined}
            title={locked ? "Tap EDIT to change status" : `Set status: ${o}`}
            onClick={() => onChange(o)}>
            <i className={`ti ti-${STATUS_ICON[o] || "circle"}`} aria-hidden="true" />{o}
          </button>
        );
      })}
    </div>
  );
}
