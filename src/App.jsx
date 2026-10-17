import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import TaskCard from "./components/TaskCard.jsx";
import TaskModal from "./components/TaskModal.jsx";
import DocModal from "./components/DocModal.jsx";
import ExportModal from "./components/ExportModal.jsx";
import HeaderModal from "./components/HeaderModal.jsx";
import EditLoginModal from "./components/EditLoginModal.jsx";
import Lightbox from "./components/Lightbox.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { Pill, ConfirmDialog } from "./components/ui.jsx";
import { AREAS, SPACES, RESPONSIBLE, STATUSES, SORTS, DEFAULT_HEADER, HEADER_EDITORS, taskPriority } from "./config.js";
import { fmtDateTime, isOverdue } from "./lib/format.js";
import { fetchState, saveState, loadSession, saveSession, postComment } from "./lib/api.js";
import { mergeComments } from "./lib/merge.js";
import { safeUrl } from "./lib/format.js";

const STATUS_ORDER = { "To Do": 0, "Planned": 1, "In Progress": 2, "Completed": 3 };
const SORTERS = {
  due:     (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title),
  updated: (a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  title:   (a, b) => a.title.localeCompare(b.title),
  status:  (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.title.localeCompare(b.title),
};
const LAST_PROFILE_KEY = "calais-last-profile";
const snapshot = (tasks, header, links) => JSON.stringify([tasks, header, links]);

/* Task bands, each on its own background:
   HIGH (terracotta) and LOW (sage) hold open tasks; COMPLETED (cool slate,
   green accent) holds finished tasks whatever their priority. */
const GROUPS = {
  High: { icon: "flame",        title: "High priority", note: "Needs attention first",                          empty: "No open high-priority tasks match the current filters." },
  Low:  { icon: "leaf",         title: "Low priority",  note: "Can be scheduled after the high-priority items", empty: "No open low-priority tasks match the current filters." },
  Done: { icon: "circle-check", title: "Completed",     note: "Finished tasks",                                 empty: "No completed tasks yet." },
};

function TaskGroup({ level, tasks, cardProps, collapsed, onToggle }) {
  const g = GROUPS[level];
  return (
    <section className={`prio-group prio-group-${level.toLowerCase()}${collapsed ? " is-collapsed" : ""}`} aria-labelledby={`grp-${level}`}>
      <div className="prio-group-inner">
        <header className="prio-group-head">
          <div className="prio-group-title">
            <i className={`ti ti-${g.icon}`} aria-hidden="true" />
            <h2 id={`grp-${level}`}>{g.title}</h2>
            <span className="prio-count">{tasks.length}</span>
          </div>
          <p>{g.note}</p>
          {onToggle && (
            <button type="button" className="group-toggle" onClick={onToggle} aria-expanded={!collapsed}>
              <i className={`ti ti-chevron-${collapsed ? "down" : "up"}`} aria-hidden="true" />{collapsed ? "Show" : "Hide"}
            </button>
          )}
        </header>
        {collapsed ? null : tasks.length === 0
          ? <p className="prio-empty">{g.empty}</p>
          : <div className="task-grid">{tasks.map(t => <TaskCard key={t.id} task={t} {...cardProps} />)}</div>}
      </div>
    </section>
  );
}

export default function App() {
  /* ── Data ── */
  const [tasks,       setTasks]       = useState([]);
  const [header,      setHeader]      = useState(DEFAULT_HEADER);
  const [globalLinks, setGlobalLinks] = useState([]);
  const [loadStatus,  setLoadStatus]  = useState("loading"); // loading | ready | error
  const [lastSaved,   setLastSaved]   = useState(null);
  const [lastSavedBy, setLastSavedBy] = useState(null);
  const [saveStatus,  setSaveStatus]  = useState("idle");    // idle | saving | saved | error

  /* ── Edit session ── */
  const [session, setSession] = useState(loadSession);
  const editing = !!session;
  const editorName = session?.profile || "";
  const canEditHeader = editing && HEADER_EDITORS.includes(editorName);

  /* ── UI ── */
  const [filters, setFilters] = useState({ area:"All", space:"All", responsible:"All", status:"All" });
  const [query, setQuery]     = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  /* Collapsed sections (dashboard + each band), remembered per browser. */
  const SECTIONS = ["dash", "High", "Low", "Done"];
  const [collapsed, setCollapsed] = useState(() => {
    try { return { dash: false, High: false, Low: false, Done: false, ...JSON.parse(localStorage.getItem("calais-collapsed") || "{}") }; }
    catch { return { dash: false, High: false, Low: false, Done: false }; }
  });
  useEffect(() => { try { localStorage.setItem("calais-collapsed", JSON.stringify(collapsed)); } catch {} }, [collapsed]);
  const toggleSection = (k) => setCollapsed(c => ({ ...c, [k]: !c[k] }));
  const anyExpanded = SECTIONS.some(k => !collapsed[k]);
  const setAll = (value) => setCollapsed(Object.fromEntries(SECTIONS.map(k => [k, value])));
  const [sort, setSort]       = useState("due");
  const [modal, setModal]     = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [confirmDoc, setConfirmDoc] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [loginOpen, setLoginOpen]   = useState(false);
  const [lightbox, setLightbox]     = useState(null);
  const [toast, setToast]           = useState(null);

  /* ── Sync bookkeeping ── */
  const versionRef     = useRef(null);  // server version our edits are based on
  const syncedRef      = useRef("");    // snapshot of what the server has
  const saveTimer      = useRef(null);
  const inFlight       = useRef(false);
  const editSeq        = useRef(0);     // bumps on every local edit
  const headerDirty    = useRef(false);
  const deletedLinkIds = useRef(new Set());

  const showToast = (msg, kind = "info") => {
    setToast({ msg, kind });
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => setToast(null), 4000);
  };

  const applyServer = useCallback((res) => {
    const s = res.state || {};
    const t = s.tasks || [], h = s.header || DEFAULT_HEADER, l = s.global_links || [];
    setTasks(t); setHeader(h); setGlobalLinks(l);
    setLastSaved(res.last_saved); setLastSavedBy(res.last_saved_by);
    versionRef.current = res.version;
    syncedRef.current = snapshot(t, h, l);
  }, []);

  // refs so async code always sees the latest state
  const tasksRef = useRef(tasks), headerRef = useRef(header), linksRef = useRef(globalLinks);
  tasksRef.current = tasks; headerRef.current = header; linksRef.current = globalLinks;
  /* Unsaved local changes exist (pending, in flight, or a save that failed). */
  const isDirty = () => snapshot(tasksRef.current, headerRef.current, linksRef.current) !== syncedRef.current;

  /* ── Initial load + refresh (focus / every minute) — never over unsaved edits ── */
  const refresh = useCallback(async (initial = false) => {
    const busy = () => inFlight.current || saveTimer.current || isDirty();
    if (!initial && busy()) return;
    try {
      const res = await fetchState();
      if (initial || res.version !== versionRef.current) {
        if (!initial && busy()) return;   // user started editing meanwhile
        applyServer(res);
      }
      setLoadStatus("ready");
    } catch (e) {
      if (initial) setLoadStatus("error");
    }
  }, [applyServer]);

  useEffect(() => {
    refresh(true);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(() => document.visibilityState === "visible" && refresh(), 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(iv); };
  }, [refresh]);

  /* ── Save ── returns true when the server has everything that was on screen */
  const persist = useCallback(async () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!session || inFlight.current) return false;
    inFlight.current = true;
    const seqAtStart = editSeq.current;
    let ok = false;
    setSaveStatus("saving");
    try {
      const res = await saveState(session.token, {
        state: { tasks: tasksRef.current, header: headerRef.current, global_links: linksRef.current },
        baseVersion: versionRef.current,
        meta: { headerDirty: headerDirty.current, deletedLinkIds: [...deletedLinkIds.current] },
      });
      if (editSeq.current === seqAtStart) {
        applyServer(res);                 // includes other people's merged changes
        headerDirty.current = false;
        deletedLinkIds.current = new Set();
        ok = true;
      } else {
        // edited while saving: keep local edits; the next save merges against the server
        setLastSaved(res.last_saved); setLastSavedBy(res.last_saved_by);
      }
      if (res.merged) showToast("Merged with changes someone else saved a moment ago.");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(st => (st === "saved" ? "idle" : st)), 2500);
    } catch (e) {
      setSaveStatus("error");
      if (e.status === 401) {
        setSession(null); saveSession(null);
        showToast("Your edit session expired — tap EDIT to continue. Your unsaved changes are kept on screen.", "error");
      } else {
        showToast(`${e.message || "Could not save."} Retrying shortly…`, "error");
        if (!e.status || e.status >= 500) {  // network / server hiccup → try again
          saveTimer.current = setTimeout(() => persistRef.current(), 15000);
        }
      }
    } finally {
      inFlight.current = false;
      if (editSeq.current !== seqAtStart && session && !saveTimer.current) scheduleSave();
    }
    return ok;
  }, [session, applyServer]);

  const scheduleSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistRef.current(), 250);
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  /* Auto-save (debounced) whenever data differs from what the server has. */
  useEffect(() => {
    if (loadStatus !== "ready" || !session) return;
    if (snapshot(tasks, header, globalLinks) === syncedRef.current) return;
    editSeq.current++;
    scheduleSave();
  }, [tasks, header, globalLinks, session, loadStatus]);

  /* Leaving the page (close, reload, switch app on a phone): send anything
     pending immediately. keepalive lets the request finish after the page is gone. */
  useEffect(() => {
    const flush = () => {
      if (!session || inFlight.current || !isDirty()) return;
      clearTimeout(saveTimer.current); saveTimer.current = null;
      const payload = {
        state: { tasks: tasksRef.current, header: headerRef.current, global_links: linksRef.current },
        baseVersion: versionRef.current,
        meta: { headerDirty: headerDirty.current, deletedLinkIds: [...deletedLinkIds.current] },
      };
      const small = JSON.stringify(payload).length < 60000;   // browsers cap keepalive bodies at 64 KB
      if (small) saveState(session.token, payload, { keepalive: true }).then(applyServer).catch(() => {});
      else persistRef.current();
    };
    const onVis = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVis); };
  }, [session, applyServer]);

  /* Warn before closing the tab with unsaved changes. */
  useEffect(() => {
    const h = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  /* ── Edit session actions ── */
  const startEditing = (res) => {
    const s = { token: res.token, profile: res.profile, exp: res.exp };
    setSession(s); saveSession(s);
    try { localStorage.setItem(LAST_PROFILE_KEY, res.profile); } catch {}
    setLoginOpen(false);
    showToast(`Editing as ${res.profile}. Changes save automatically.`);
  };
  /* Done: flush everything first; only leave edit mode once the server has it. */
  const stopEditing = async () => {
    const idle = async () => { while (inFlight.current) await new Promise(r => setTimeout(r, 100)); };
    for (let i = 0; i < 3 && isDirty(); i++) { await idle(); await persist(); }
    await idle();
    if (isDirty()) { showToast("Couldn't save your last changes yet — staying in edit mode.", "error"); return; }
    clearTimeout(saveTimer.current); saveTimer.current = null;
    setSession(null); saveSession(null);
    showToast("Edit mode off — view only.");
  };
  const requestEdit = () => setLoginOpen(true);
  const lastProfile = (() => { try { return localStorage.getItem(LAST_PROFILE_KEY) || ""; } catch { return ""; } })();

  /* ── Task mutations ── */
  const stamp = () => ({ updatedBy: editorName, updatedAt: new Date().toISOString() });
  const editTask = (id, patch) => {
    if (!editing) { requestEdit(); return; }
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch, ...stamp() } : t)));
  };
  const saveModal = (form) => {
    const now = new Date().toISOString();
    if (form.id) {
      setTasks(ts => ts.map(t => (t.id === form.id ? { ...t, ...form, ...stamp() } : t)));
    } else {
      setTasks(ts => [...ts, { ...form, id: Date.now(), createdBy: editorName, createdAt: now, ...stamp() }]);
    }
    setModal(null);
  };
  /* Comments are saved straight to the server (/api/comment), one by one —
     not via the debounced autosave — and only show as saved once stored. */
  const addComment = async (taskId, text, image, clientId) => {
    if (!session) { requestEdit(); throw Object.assign(new Error("Tap EDIT to sign in first."), { status: 401 }); }
    try {
      const res = await postComment(session.token, { taskId, text, image, clientId });
      if (!inFlight.current && !saveTimer.current && !isDirty()) {
        applyServer(res);                      // nothing pending locally → take the server copy
      } else {
        // other edits are pending: add the server's comments to this task only;
        // the next autosave merges (comments are unioned, so nothing is lost)
        const srv = (res.state.tasks || []).find(t => String(t.id) === String(taskId));
        if (srv) setTasks(ts => ts.map(t => (t.id === taskId ? { ...t, comments: mergeComments(t.comments, srv.comments) } : t)));
        setTimeout(() => persistRef.current(), 0);   // flush the other pending edits now
      }
      setLastSaved(res.last_saved); setLastSavedBy(res.last_saved_by);
      return res;
    } catch (e) {
      if (e.status === 401) {
        setSession(null); saveSession(null);
        setLoginOpen(true);
      }
      throw e;
    }
  };
  const deleteTask = (task) => { editTask(task.id, { deleted: true }); setModal(null); showToast(`Deleted “${task.title}”.`); };

  /* ── Derived ── */
  const live = useMemo(() => tasks.filter(t => !t.deleted), [tasks]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live.filter(t =>
      (filters.area === "All"        || t.area === filters.area) &&
      (filters.space === "All"       || t.space === filters.space) &&
      (filters.responsible === "All" || t.responsible === filters.responsible) &&
      (filters.status === "All"      || t.status === filters.status) &&
      (!q || `${t.title} ${t.problem}`.toLowerCase().includes(q)) &&
      (!overdueOnly || isOverdue(t))
    ).sort(SORTERS[sort]);
  }, [live, filters, query, sort, overdueOnly]);
  const isDone    = (t) => t.status === "Completed";
  const highTasks = filtered.filter(t => !isDone(t) && taskPriority(t) === "High");
  const lowTasks  = filtered.filter(t => !isDone(t) && taskPriority(t) === "Low");
  const doneTasks = filtered.filter(isDone);

  const activeFilters = Object.values(filters).some(v => v !== "All") || query || overdueOnly;

  const cardProps = {
    editing, editorName, onEdit: editTask, onRequestEdit: requestEdit, onComment: addComment,
    onEditOpen: (t) => setModal({ mode: "edit", task: t }),
    onOpenImage: (src, alt) => setLightbox({ src, alt }),
    onMoved: (task, where) => {
      const target = where === "Completed" ? "Done" : where.startsWith("HIGH") ? "High" : "Low";
      setCollapsed(c => ({ ...c, [target]: false }));       // make sure the card is visible
      showToast(`“${task.title}” moved to ${where}.`);
      setTimeout(() => {   // after re-render the card lives in the other band
        const el = document.getElementById(`task-${task.id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      }, 60);
    },
  };

  if (loadStatus === "loading") {
    return <div className="center-screen"><i className="ti ti-loader-2 spin" aria-label="Loading" /></div>;
  }
  if (loadStatus === "error") {
    return (
      <div className="center-screen stack-12">
        <p>Couldn't load the task list.</p>
        <button type="button" className="btn" onClick={() => { setLoadStatus("loading"); refresh(true); }}>Try again</button>
      </div>
    );
  }

  return (
    <div className={editing ? "app is-editing" : "app"}>
      {/* ── HERO ── */}
      <header className="hero">
        <img src={header.image || DEFAULT_HEADER.image} alt="" fetchpriority="high" />
        <div className="hero-shade">
          <p className="hero-kicker">Property task manager</p>
          <h1>{header.title}</h1>
          <p className="hero-sub">{header.subtitle}</p>
        </div>
        <div className="hero-top">
          {editing ? (
            <div className="hero-cluster">
              <span className="hero-btn editing-chip" title={`Editing as ${editorName}`}>
                <span className="avatar sm" aria-hidden="true">{editorName[0]}</span>
                <span>Editing as <b>{editorName}</b></span>
              </span>
              {canEditHeader && (
                <button type="button" onClick={() => setHeaderOpen(true)} className="hero-btn" title="Edit header">
                  <i className="ti ti-photo-edit" /><span className="hero-label">Header</span>
                </button>
              )}
              <button type="button" onClick={stopEditing} className="hero-btn btn-done">
                <i className="ti ti-check" /> Done
              </button>
            </div>
          ) : (
            <button type="button" onClick={requestEdit} className="btn-edit-hero">
              <i className="ti ti-pencil" /> EDIT
            </button>
          )}
        </div>
      </header>

      {/* ── DASHBOARD ── */}
      <Dashboard tasks={live} collapsed={collapsed.dash} onToggle={() => toggleSection("dash")}
        statusFilter={filters.status} onStatus={(st) => setFilters(f => ({ ...f, status: st }))}
        overdueOnly={overdueOnly} onOverdue={() => setOverdueOnly(v => !v)}
        onJump={(level) => document.getElementById(`grp-${level}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      {/* ── ACTION BAR ── */}
      <div className="sticky-bar stat-bar">
        <div className="stat-row">
          <div className="bar-title">
            <i className="ti ti-list-check" aria-hidden="true" />
            <b>{filtered.length}</b> of {live.length} tasks shown
            <button type="button" className="btn-expand" onClick={() => setAll(anyExpanded)} aria-label={anyExpanded ? "Collapse all sections" : "Expand all sections"}>
              <i className={`ti ti-${anyExpanded ? "fold" : "fold-down"}`} aria-hidden="true" />{anyExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>
          <div className="stat-actions">
            <span className="saved-at" aria-live="polite">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved"
                : lastSaved ? `Saved ${fmtDateTime(lastSaved)}${lastSavedBy ? " · " + lastSavedBy : ""}` : ""}
            </span>
            {editing && saveStatus === "error" && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => persist()}><i className="ti ti-refresh" />Retry</button>
            )}
            <button type="button" onClick={() => setExportOpen(true)} className="btn btn-sm"><i className="ti ti-download" />Export</button>
            {editing
              ? <button type="button" onClick={() => setModal({ mode: "new" })} className="btn btn-sm btn-primary"><i className="ti ti-plus" />New task</button>
              : <button type="button" onClick={requestEdit} className="btn btn-sm btn-edit"><i className="ti ti-pencil" />EDIT</button>}
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="filter-bar">
        <div className="filter-inner">
          <div className="search-row">
            <label className="search">
              <i className="ti ti-search" aria-hidden="true" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
            </label>
            <label className="sort">
              <span>Sort</span>
              <select value={sort} onChange={e => setSort(e.target.value)} className="field">
                {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            {activeFilters && (
              <button type="button" className="link-btn" onClick={() => { setFilters({ area:"All", space:"All", responsible:"All", status:"All" }); setQuery(""); setOverdueOnly(false); }}>
                <i className="ti ti-x" />Clear filters
              </button>
            )}
          </div>
          {[["Area","area",AREAS],["Space","space",SPACES],["Responsible","responsible",RESPONSIBLE],["Status","status",STATUSES]].map(([label, key, opts]) => (
            <div key={key} className="filter-group" role="group" aria-label={label}>
              <span className="filter-label">{label}</span>
              {opts.map(o => <Pill key={o} label={o} active={filters[key] === o} onClick={() => setFilters(f => ({ ...f, [key]: o }))} />)}
            </div>
          ))}
        </div>
      </div>

      {!editing && (
        <div className="view-banner">
          <i className="ti ti-eye" /> You're viewing. Tap <button type="button" onClick={requestEdit} className="inline-edit">EDIT</button> to change tasks, priorities or comments.
        </div>
      )}

      {/* ── PRIORITY GROUPS ── */}
      <main>
        {["High", "Low", "Done"].map(level => (
          <TaskGroup key={level} level={level} cardProps={cardProps}
            tasks={level === "High" ? highTasks : level === "Low" ? lowTasks : doneTasks}
            collapsed={collapsed[level]} onToggle={() => toggleSection(level)} />
        ))}

        {/* ── DOCUMENTS ── */}
        <div className="content-wrap">
          <section className="docs" aria-labelledby="docs-title">
            <div className="row-between docs-head">
              <h2 id="docs-title" className="section-label flush">Property documents</h2>
              {editing && (
                <button type="button" onClick={() => setDocModal({ mode: "new" })} className="btn btn-sm btn-primary">
                  <i className="ti ti-plus" />Add document
                </button>
              )}
            </div>
            {globalLinks.length === 0 && <p className="muted small">No documents yet.</p>}
            <div className="stack-8">
              {globalLinks.map(l => (
                <div key={l.id} className="doc-row">
                  <a href={safeUrl(l.url) || undefined} target="_blank" rel="noopener noreferrer">
                    <i className="ti ti-file" /><span>{l.name}</span>
                  </a>
                  {editing && <>
                    <button type="button" onClick={() => setDocModal({ mode: "edit", link: l })} aria-label={`Edit ${l.name}`} className="icon-btn"><i className="ti ti-pencil" /></button>
                    <button type="button" onClick={() => setConfirmDoc(l)} aria-label={`Delete ${l.name}`} className="icon-btn danger"><i className="ti ti-trash" /></button>
                  </>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">25B Calais Terrace · Ostend · Waiheke Island</footer>

      {/* ── MODALS ── */}
      {modal && <TaskModal task={modal.mode === "new" ? null : modal.task} onClose={() => setModal(null)} onSave={saveModal} onDelete={deleteTask} />}
      {exportOpen && <ExportModal tasks={live} currentFilters={filters} exportedBy={editorName || "Viewer"} onClose={() => setExportOpen(false)} />}
      {headerOpen && <HeaderModal header={header} onClose={() => setHeaderOpen(false)}
        onSave={(h) => { headerDirty.current = true; setHeader(h); setHeaderOpen(false); }} />}
      {loginOpen && <EditLoginModal lastProfile={lastProfile} onClose={() => setLoginOpen(false)} onSuccess={startEditing} />}
      {docModal && (
        <DocModal link={docModal.mode === "edit" ? docModal.link : null} onClose={() => setDocModal(null)}
          onSave={saved => {
            setGlobalLinks(ls => (docModal.mode === "edit" ? ls.map(l => (l.id === saved.id ? saved : l)) : [...ls, saved]));
            setDocModal(null);
          }} />
      )}
      {confirmDoc && (
        <ConfirmDialog title="Delete document?" message={`“${confirmDoc.name}” will be removed for everyone.`}
          onCancel={() => setConfirmDoc(null)}
          onConfirm={() => { deletedLinkIds.current.add(confirmDoc.id); setGlobalLinks(ls => ls.filter(l => l.id !== confirmDoc.id)); setConfirmDoc(null); }} />
      )}
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      <div aria-live="polite" className="sr-only">{toast?.kind !== "error" ? toast?.msg : ""}</div>
      {toast && <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : undefined}>{toast.msg}</div>}
    </div>
  );
}
