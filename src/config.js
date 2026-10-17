/* ════════════════════════════════════════════════════════════
   CONFIG — owner-editable
   ════════════════════════════════════════════════════════════ */

// Who can switch into EDIT mode. The shared password is checked on the
// server (Cloudflare secret EDIT_PASSWORD) — never in this file.
export const PROFILES = ["Sarah", "Dave", "Flavia", "Igor"];
// Profiles that may also change the page header (photo / address).
export const HEADER_EDITORS = ["Flavia", "Igor"];

export const PRIORITIES = ["High", "Low"];
export const DEFAULT_PRIORITY = "Low";   // tasks saved before priorities existed
export const taskPriority = (t) => (PRIORITIES.includes(t.priority) ? t.priority : DEFAULT_PRIORITY);

export const DEFAULT_HEADER = {
  image: "calais-view.jpg",
  title: "25B Calais Terrace, Ostend",
  subtitle: "Waiheke Island — Auckland — 1081",
};

/* Max edge (px) for photos uploaded from a device. They are stored in
   Cloudflare D1, so keeping them small keeps loading and saving fast. */
export const IMG_MAX = { task: 1600, comment: 1200, header: 1920 };

export const AREAS       = ["All","Indoor","Outdoor"];
export const SPACES      = ["All","General","Kitchen","Bedroom","Bathroom","Laundry","Living Room","Garage","Garden"];
export const RESPONSIBLE = ["All","Tenant","Owner"];
export const STATUSES    = ["All","To Do","Planned","In Progress","Completed"];

export const SORTS = [
  ["due",     "Due date"],
  ["updated", "Recently updated"],
  ["title",   "Title A–Z"],
  ["status",  "Status"],
];

export const STATUS_STYLE = {
  "To Do":       { bg:"#F1EFE8", color:"#5F5E5A", border:"#B4B2A9" },
  "Planned":     { bg:"#E7EFFB", color:"#1F5FA8", border:"#8FB6E8" },
  "In Progress": { bg:"#FAEEDA", color:"#854F0B", border:"#EF9F27" },
  "Completed":   { bg:"#EAF3DE", color:"#3B6D11", border:"#97C459" },
};
export const AREA_STYLE = {
  "Indoor":  { bg:"#EEEDFE", color:"#3C3489", border:"#AFA9EC" },
  "Outdoor": { bg:"#E1F5EE", color:"#085041", border:"#5DCAA5" },
};
export const RESP_STYLE = {
  "Tenant": { bg:"#FBEAF0", color:"#72243E", border:"#ED93B1" },
  "Owner":  { bg:"#FAECE7", color:"#712B13", border:"#F0997B" },
};
export const SPACE_STYLE   = { bg:"#F1EFE8", color:"#5F5E5A", border:"#B4B2A9" };
export const OVERDUE_STYLE = { bg:"#FDECEC", color:"#A32D2D", border:"#F09595" };
export const PRIORITY_STYLE = {
  "High": { bg:"#FCE3DA", color:"#9A2B0C", border:"#E8774F" },
  "Low":  { bg:"#E3EEDB", color:"#2F5A16", border:"#8FB86A" },
};
