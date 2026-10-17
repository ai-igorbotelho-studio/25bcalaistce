/* ── Date helpers ── */
export const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-NZ", { day:"numeric", month:"short", year:"numeric" });
};
export const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("en-NZ", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
};

/* Today as YYYY-MM-DD in the viewer's local time (due dates are plain dates). */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
export const isOverdue = (t) => !!t.due && t.status !== "Completed" && t.due < todayISO();

/* HTML-escape for the print/PDF window. */
export const esc = (s = "") => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* Only allow safe link schemes; bare domains get https://. Blocks javascript: etc. */
export function safeUrl(raw) {
  const u = String(raw || "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";   // any other scheme → reject
  return "https://" + u.replace(/^\/+/, "");
}

/* Random password for admin-provisioned accounts (no shared default). */
export function randomPassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join("");
}
