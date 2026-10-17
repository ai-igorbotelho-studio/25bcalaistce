# 25B Calais Terrace — Property task manager

Shared maintenance list for 25B Calais Terrace, Ostend (Waiheke Island), between the tenants
and the owners. Live at **https://25bcalais.igorbotelho.com** (moving from Netlify to
Cloudflare Pages — see [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)).

## How it works

- **Anyone with the link can view** the list. No login.
- **EDIT** (header button) → pick **Sarah, Dave, Flavia or Igor** → shared house password.
  The password is checked on the server (Cloudflare secret `EDIT_PASSWORD`), never in the browser.
- Every card has a **HIGH / LOW** priority switch. The page is grouped into a **High priority**
  band (terracotta) and a **Low priority** band (sage).
- Edits save automatically. If two people save at the same moment, their changes are merged
  (per task, the most recent edit wins; comments from both are kept).
- Flavia and Igor can also change the header photo and address.
- Export to PDF (with photos) or Excel, filtered by date range, area, space, responsible, status.

## Project layout

```
src/                 React app (compiled by esbuild — no in-browser Babel)
  App.jsx            state, sync, priority groups
  components/        TaskCard, TaskModal, EditLoginModal, ExportModal, …
  lib/               api client, merge, export, formatting, image downscaling
  config.js          profiles, lists, colours (owner-editable)
  seed.js            initial tasks (used only when the database is empty)
  vendor/            Tabler Icons subset (5 KB) — regenerate with scripts/subset-icons.py
functions/api/       Cloudflare Pages Functions: state, login, img/[id]
server/              shared server code: auth tokens, D1 state, image storage
migrations/          D1 schema
public/              static files: photos, icons, _headers (security headers), manifest
scripts/             build, smoke test, icon subsetting
archive/             the original 3 May 2026 maintenance report (not deployed)
docs/                deployment guide
```

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # set EDIT_PASSWORD
npx wrangler d1 migrations apply calais-25b --local
npm run preview                       # build + wrangler pages dev on http://127.0.0.1:8788
EDIT_PASSWORD=<same as .dev.vars> npm test   # other terminal: Playwright end-to-end test
```

## Changing things

- **Who can edit:** `PROFILES` in `src/config.js` (and `HEADER_EDITORS` for the header).
- **Password:** change the `EDIT_PASSWORD` secret in Cloudflare (signs everyone out).
  Ten wrong passwords from one IP block it for 15 minutes.
- **Icons:** after using a new `ti-*` icon, run `python3 scripts/subset-icons.py`.
