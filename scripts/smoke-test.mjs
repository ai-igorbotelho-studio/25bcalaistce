/* End-to-end smoke test (Playwright + Chromium).
   Start the app first:   npm run preview      (wrangler pages dev, local D1)
   then:                  node scripts/smoke-test.mjs [baseUrl] [password]
   Screenshots go to ./test-results/. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8788";
const PASSWORD = process.argv[3] || process.env.EDIT_PASSWORD;
if (!PASSWORD) { console.error("Pass the EDIT password: node scripts/smoke-test.mjs <baseUrl> <password>"); process.exit(2); }
const OUT = "test-results";
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "✔" : "✘"} ${msg}`); if (!ok) failures++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => m.type() === "error" && !m.text().includes("401") && errors.push(m.text())); // 401 = the deliberate wrong-password test

await page.goto(BASE, { waitUntil: "networkidle" });
check(await page.locator(".prio-group-high").isVisible(), "HIGH priority group is shown");
check(await page.locator(".prio-group-low").isVisible(), "LOW priority group is shown");
check(await page.locator(".btn-edit-hero").isVisible(), "EDIT button is visible in the header");
check(await page.locator(".task-card").count() > 0, "task cards render without signing in");
await page.screenshot({ path: `${OUT}/01-view-desktop.png`, fullPage: true });

// Changing priority while viewing asks to sign in
await page.locator(".prio-group-low .task-card .prio-opt.prio-high").first().click();
check(await page.locator(".profile-grid").isVisible(), "priority click in view mode opens the EDIT sign-in");

// Wrong password, then correct
await page.locator(".profile-btn", { hasText: "SARAH" }).click();
await page.fill('input[type="password"]', "wrong-password");
await page.click("button:has-text('Start editing')");
await page.waitForSelector(".form-error");
check(true, "wrong password is rejected");
await page.screenshot({ path: `${OUT}/02-edit-login.png` });
await page.fill('input[type="password"]', PASSWORD);
await page.click("button:has-text('Start editing')");
await page.waitForSelector(".editing-chip");
check((await page.locator(".editing-chip").innerText()).includes("Sarah"), "editing as Sarah");

// Promote the first LOW task to HIGH
const highBefore = await page.locator(".prio-group-high .task-card").count();
const firstLow = page.locator(".prio-group-low .task-card").first();
const title = await firstLow.locator("h3").innerText();
await firstLow.locator(".prio-opt.prio-high").click();
await page.waitForFunction(n => document.querySelectorAll(".prio-group-high .task-card").length === n + 1, highBefore);
check(true, `“${title}” moved to HIGH`);
await page.waitForFunction(() => /Saved .*Sarah/.test(document.querySelector(".saved-at")?.textContent || ""), null, { timeout: 10000 });
check(true, "change auto-saved by Sarah");

// Status buttons on the card
const card = page.locator(".task-card", { hasText: title });
await card.locator(".status-select select").selectOption("In Progress");
check(await card.locator(".status-select select").inputValue() === "In Progress", "status changed to In Progress from the card dropdown");

// Comment: EDIT > Comment > Save — stored on the server, author = signed-in profile
await card.locator(".btn-comment").click();
await card.locator(".composer textarea").fill("Smoke test comment");
await card.locator("button:has-text('Save comment')").click();
await card.locator(".comment-saved").waitFor({ timeout: 10000 });
check(await card.locator(".comment", { hasText: "Smoke test comment" }).locator("b").innerText() === "Sarah",
  "comment saved with author Sarah");

// Unsaved draft survives a page reload
await card.locator(".btn-comment").click();
await card.locator(".composer textarea").fill("Draft that must not vanish");
await page.waitForTimeout(300);
await page.reload({ waitUntil: "networkidle" });
const draftCard = page.locator(".task-card", { hasText: title });
check(await draftCard.locator(".composer textarea").inputValue() === "Draft that must not vanish", "unsaved comment draft survives a reload");
await draftCard.locator(".composer button:has-text('Cancel')").click();
await page.waitForTimeout(1500);

// Persisted after reload
await page.reload({ waitUntil: "networkidle" });
const persisted = page.locator(".prio-group-high .task-card", { hasText: title });
check(await persisted.count() === 1, "priority persisted after reload");
await persisted.locator(".comments-toggle").click();
check(await persisted.locator(".comment", { hasText: "Smoke test comment" }).count() === 1, "comment persisted after reload");
check((await persisted.locator(".status-select select").inputValue()) === "In Progress", "status persisted after reload");
await page.screenshot({ path: `${OUT}/03-edit-desktop.png`, fullPage: true });

// Completed band + expand / collapse all
const doneBefore = await page.locator(".prio-group-done .task-card").count();
const toFinish = page.locator(".prio-group-low .task-card").first();
const finishTitle = await toFinish.locator("h3").innerText();
await toFinish.locator(".status-select select").selectOption("Completed");
await page.waitForFunction(n => document.querySelectorAll(".prio-group-done .task-card").length === n + 1, doneBefore);
check(await page.locator(".prio-group-done .task-card", { hasText: finishTitle }).count() === 1, "completed task moves to the Completed band");
await page.evaluate(() => window.scrollTo(0, 0));
await page.click(".btn-expand");
check(await page.locator(".task-grid").count() === 0 && await page.locator(".dash-summary").isVisible(), "Collapse all hides every band and the dashboard");
await page.click(".btn-expand");
check(await page.locator(".dash .dash-card").count() === 4 && await page.locator(".prio-group.is-collapsed").count() === 0, "Expand all shows everything again");

// Two editors saving on the same base version → both changes kept (merge)
const login = async (p) => (await (await fetch(`${BASE}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: p, password: PASSWORD }) })).json()).token;
const [tDave, tIgor] = await Promise.all([login("Dave"), login("Igor")]);
const base = await (await fetch(`${BASE}/api/state`)).json();
const put = (token, mutate) => {
  const s = structuredClone(base.state); mutate(s.tasks);
  return fetch(`${BASE}/api/state`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ state: s, baseVersion: base.version, meta: {} }) }).then(r => r.json());
};
const now = () => new Date().toISOString();
await put(tDave, ts => { ts[0].status = "Planned"; ts[0].updatedAt = now(); ts[0].updatedBy = "Dave"; });
const r2 = await put(tIgor, ts => { ts[1].status = "In Progress"; ts[1].updatedAt = now(); ts[1].updatedBy = "Igor"; });
check(r2.merged === true && r2.state.tasks[0].status === "Planned" && r2.state.tasks[1].status === "In Progress",
  "concurrent saves from Dave and Igor are merged, nothing lost");
// A comment must survive another editor's stale save (old baseVersion)
const CID = `smoke-dave-${Date.now()}`;
const fresh = await (await fetch(`${BASE}/api/state`)).json();
const cRes = await (await fetch(`${BASE}/api/comment`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tDave}` },
  body: JSON.stringify({ taskId: fresh.state.tasks[2].id, text: "Dave's comment", clientId: CID }) })).json();
const stale = structuredClone(fresh.state); stale.tasks[3].status = "Planned"; stale.tasks[3].updatedAt = now();
const sRes = await (await fetch(`${BASE}/api/state`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${tIgor}` },
  body: JSON.stringify({ state: stale, baseVersion: fresh.version, meta: {} }) })).json();
check(cRes.comment?.author === "Dave" && sRes.state.tasks[2].comments.some(c => c.id === CID) && sRes.state.tasks[3].status === "Planned",
  "comment survives a concurrent stale save, and that save is kept too");
// Retrying the same comment (e.g. after a dropped connection) stores it once
const retry = await (await fetch(`${BASE}/api/comment`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tDave}` },
  body: JSON.stringify({ taskId: fresh.state.tasks[2].id, text: "Dave's comment", clientId: CID }) })).json();
check(retry.duplicate === true && retry.state.tasks[2].comments.filter(c => c.id === CID).length === 1, "retried comment is not duplicated");
const anonC = await fetch(`${BASE}/api/comment`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: 1, text: "x" }) });
check(anonC.status === 401, "commenting without signing in is refused (401)");

const anon = await fetch(`${BASE}/api/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" });
check(anon.status === 401, "saving without signing in is refused (401)");

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
await m.goto(BASE, { waitUntil: "networkidle" });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 0, `no horizontal scroll on mobile (overflow ${overflow}px)`);
await m.screenshot({ path: `${OUT}/04-view-mobile.png`, fullPage: true });

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
