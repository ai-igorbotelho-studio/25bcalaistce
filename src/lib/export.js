import { fmtDateTime, esc, safeUrl } from "./format.js";

/* ════════════════════════════════════════════════════════════
   EXPORT — shared filtering + PDF + Excel
   ════════════════════════════════════════════════════════════ */
export function applyExportFilters(tasks, opts) {
  const { from, to, area, space, responsible, status } = opts;
  return tasks.filter(t => {
    if (t.deleted) return false;
    if (area        !== "All" && t.area        !== area)        return false;
    if (space       !== "All" && t.space       !== space)       return false;
    if (responsible !== "All" && t.responsible !== responsible) return false;
    if (status      !== "All" && t.status      !== status)      return false;
    if (from || to) {
      if (!t.due) return false;            // no due date can't sit inside a date range
      if (from && t.due < from) return false;
      if (to   && t.due > to)   return false;
    }
    return true;
  });
}

/* SheetJS (~1 MB) is only downloaded when someone actually exports. */
export async function exportExcel(tasks, opts, exportedBy) {
  const XLSX = await import("xlsx");
  const stamp = new Date();
  const meta = [
    ["25B Calais Terrace — Property Task Manager"],
    ["Waiheke Island — Auckland — 1081"],
    ["Exported", stamp.toLocaleString("en-NZ")],
    ["Exported by", exportedBy],
    ["Date range", (opts.from || "any") + "  →  " + (opts.to || "any")],
    ["Filters", `Area: ${opts.area} · Space: ${opts.space} · Responsible: ${opts.responsible} · Status: ${opts.status}`],
    ["Tasks included", tasks.length],
    [],
  ];
  const header = ["ID","Title","What needs resolving","Area","Space","Responsible","Status","Due","Last edited by","Last edited at","Comments","Links"];
  const rows = tasks.map(t => [
    t.id, t.title, t.problem, t.area, t.space, t.responsible, t.status,
    t.due || "",
    t.updatedBy || "",
    t.updatedAt ? new Date(t.updatedAt).toLocaleString("en-NZ") : "",
    (t.comments||[]).map(c => `[${fmtDateTime(c.date)}] ${c.author}: ${c.text}${c.image ? " [photo attached]" : ""}`).join("\n"),
    (t.links||[]).map(l => `${l.name}: ${l.url}`).join("\n"),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...meta, header, ...rows]);
  ws["!cols"] = [{wch:5},{wch:30},{wch:48},{wch:9},{wch:11},{wch:11},{wch:12},{wch:12},{wch:18},{wch:18},{wch:50},{wch:36}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  XLSX.writeFile(wb, `25B-Calais-tasks-${stamp.toISOString().slice(0,10)}.xlsx`);
}

/* Images in the print window need absolute URLs (it opens as about:blank). */
const absImg = (src) => !src ? "" : src.startsWith("data:") ? src : new URL(src, window.location.href).href;

export function exportPDF(tasks, opts, exportedBy) {
  const stamp = new Date();
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow pop-ups for this site to export a PDF."); return; }
  const filterLine = `Area: ${opts.area} · Space: ${opts.space} · Responsible: ${opts.responsible} · Status: ${opts.status}`;
  const rangeLine  = (opts.from || opts.to)
    ? `Due between ${opts.from || "any"} and ${opts.to || "any"}` : "All dates";
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>25B Calais — Property Tasks</title>
    <style>body{font-family:Arial,sans-serif;font-size:13px;padding:32px;max-width:760px;margin:auto;color:#1a1a1a}
    h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:20px 0 4px}.meta{color:#666;font-size:12px}
    .summary{color:#444;font-size:12px;margin:6px 0 0;line-height:1.6}
    .comment{background:#f5f5f5;border-radius:6px;padding:8px;margin:4px 0;font-size:12px}
    .task{break-inside:avoid}.task-img{max-width:100%;max-height:260px;border-radius:8px;margin:6px 0}
    hr{border:0;border-top:1px solid #eee;margin:16px 0}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;margin-right:4px;background:#eee}</style>
    </head><body>
    <h1>Property Task Manager</h1>
    <p class="meta">25B Calais Terrace, Ostend — Waiheke Island — Auckland — 1081</p>
    <p class="summary">
      <b>Exported:</b> ${esc(stamp.toLocaleString("en-NZ"))}<br>
      <b>Exported by:</b> ${esc(exportedBy)}<br>
      <b>Date range:</b> ${esc(rangeLine)}<br>
      <b>Filters:</b> ${esc(filterLine)}<br>
      <b>Tasks included:</b> ${tasks.length}
    </p><hr>
    ${tasks.map(t=>`<div class="task"><h2>${esc(t.title)}</h2>
      <div class="meta"><span class="badge">${esc(t.area)}</span><span class="badge">${esc(t.space)}</span>
      <span class="badge">${esc(t.responsible)}</span><span class="badge">${esc(t.status)}</span> Due: ${esc(t.due||"—")}</div>
      ${t.image ? `<img class="task-img" src="${esc(absImg(t.image))}" alt="">` : ""}
      <p>${esc(t.problem)}</p>
      ${(t.comments||[]).map(c=>`<div class="comment"><strong>${esc(c.author)}</strong> <span style="color:#999">${esc(fmtDateTime(c.date))}</span><br>${esc(c.text)}${c.image?`<br><img src="${esc(c.image)}" style="max-width:100%;max-height:240px;border-radius:6px;margin-top:5px" />`:""}</div>`).join("")}
      ${(t.links||[]).map(l=>`<div><a href="${esc(safeUrl(l.url))}">${esc(l.name)}</a></div>`).join("")}</div><hr>`).join("")}
    </body></html>`);
  win.document.close();
  win.focus();
  // wait for photos before opening the print dialog
  const imgs = [...win.document.images];
  Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })))
    .then(() => setTimeout(() => win.print(), 150));
}
