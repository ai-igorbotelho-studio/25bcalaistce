import { taskPriority } from "../config.js";
import { isOverdue } from "../lib/format.js";

/* Colour code (validated for colour-blind separation):
   priority → HIGH terracotta / LOW teal-green (same as the bands and switches)
   status   → To Do grey · Planned blue · In Progress amber · Completed green
   attention→ Overdue red, always with an icon.
   Numbers stay in ink; the coloured dot/bar next to them carries the meaning. */
const STATUS_ORDER = [
  ["To Do",       "todo"],
  ["Planned",     "planned"],
  ["In Progress", "progress"],
  ["Completed",   "done"],
];

/* Part-to-whole bar: segments sized by count, 2px gaps, rounded ends. */
function StackBar({ parts, total, label }) {
  const shown = parts.filter(p => p.value > 0);
  return (
    <div className="stackbar" role="img" aria-label={`${label}: ${parts.map(p => `${p.label} ${p.value}`).join(", ")}`}>
      {total === 0
        ? <span className="stackbar-empty" />
        : shown.map(p => (
            <span key={p.key} className={`seg seg-${p.key}`} style={{ flexGrow: p.value }}
              title={`${p.label}: ${p.value} of ${total} (${Math.round((p.value / total) * 100)}%)`} />
          ))}
    </div>
  );
}

function LegendRow({ k, label, value, icon, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`legend-row${active ? " active" : ""}`} onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}>
      <span className={`dot dot-${k}`} aria-hidden="true">{icon && <i className={`ti ti-${icon}`} />}</span>
      <span className="legend-label">{label}</span>
      <span className="legend-value">{value}</span>
    </Tag>
  );
}

export default function Dashboard({ tasks, statusFilter, onStatus, overdueOnly, onOverdue, onJump, collapsed, onToggle }) {
  const total = tasks.length;
  const high = tasks.filter(t => taskPriority(t) === "High").length;
  const low = total - high;
  const byStatus = Object.fromEntries(STATUS_ORDER.map(([s]) => [s, tasks.filter(t => t.status === s).length]));
  const done = byStatus["Completed"];
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  const overdue = tasks.filter(isOverdue).length;
  const open = total - done;

  if (collapsed) {
    return (
      <section className="dash dash-collapsed" aria-label="Task overview (collapsed)">
        <button type="button" className="dash-card dash-summary" onClick={onToggle} aria-expanded="false">
          <span className="dash-kicker">Overview</span>
          <span className="sum-item"><b>{total}</b> tasks</span>
          <span className="sum-item"><span className="dot dot-high" aria-hidden="true" /><b>{high}</b> high</span>
          <span className="sum-item"><span className="dot dot-done" aria-hidden="true" /><b>{pctDone}%</b> done</span>
          <span className={`sum-item${overdue ? " sum-alert" : ""}`}><i className={`ti ti-${overdue ? "alert-triangle" : "circle-check"}`} aria-hidden="true" /><b>{overdue}</b> overdue</span>
          <span className="sum-show"><i className="ti ti-chevron-down" aria-hidden="true" />Show dashboard</span>
        </button>
      </section>
    );
  }

  return (
    <section className="dash" aria-label="Task overview">
      <button type="button" className="dash-hide" onClick={onToggle} aria-expanded="true">
        <i className="ti ti-chevron-up" aria-hidden="true" />Hide dashboard
      </button>
      {/* Overview — the one hero number */}
      <div className="dash-card dash-overview">
        <div className="dash-kicker">Overview</div>
        <div className="hero-figure">{total}<span>tasks</span></div>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctDone} aria-label="Completed">
          <span style={{ width: `${pctDone}%` }} />
        </div>
        <div className="dash-note"><b>{pctDone}%</b> completed · {open} open</div>
      </div>

      {/* Priority */}
      <div className="dash-card dash-priority">
        <div className="dash-kicker">Priority</div>
        <StackBar label="Priority" total={total}
          parts={[{ key: "high", label: "High", value: high }, { key: "low", label: "Low", value: low }]} />
        <div className="legend legend-2">
          <LegendRow k="high" label="High" value={high} icon="flame" onClick={() => onJump("High")} />
          <LegendRow k="low"  label="Low"  value={low}  icon="leaf"  onClick={() => onJump("Low")} />
        </div>
      </div>

      {/* Status */}
      <div className="dash-card dash-status">
        <div className="dash-kicker">Status <span className="dash-hint">tap to filter</span></div>
        <StackBar label="Status" total={total}
          parts={STATUS_ORDER.map(([s, k]) => ({ key: k, label: s, value: byStatus[s] }))} />
        <div className="legend legend-4">
          {STATUS_ORDER.map(([s, k]) => (
            <LegendRow key={s} k={k} label={s} value={byStatus[s]}
              active={statusFilter === s} onClick={() => onStatus(statusFilter === s ? "All" : s)} />
          ))}
        </div>
      </div>

      {/* Attention */}
      <button type="button" className={`dash-card dash-alert${overdue ? "" : " calm"}${overdueOnly ? " active" : ""}`}
        onClick={onOverdue} aria-pressed={overdueOnly}>
        <div className="dash-kicker"><i className={`ti ti-${overdue ? "alert-triangle" : "circle-check"}`} aria-hidden="true" /> Overdue</div>
        <div className="alert-figure">{overdue}</div>
        <div className="dash-note">{overdue ? (overdueOnly ? "Showing overdue only · tap to show all" : "past due date · tap to show") : "Nothing past due"}</div>
      </button>
    </section>
  );
}
