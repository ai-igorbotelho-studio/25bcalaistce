# Deploying to Cloudflare Pages

**Target:** `https://25bcalais.igorbotelho.com` served by Cloudflare Pages (static site + Pages
Functions + D1 database), replacing the current Netlify site.

## Already done (from this repository's session)

| Item | Status |
|---|---|
| D1 database `calais-25b` (region: Oceania) | ✅ created, id `ab5e6731-f118-4d71-beda-04f092ca3ff1` |
| D1 schema (`state`, `images`, `login_attempts` tables) | ✅ applied to the remote database |
| `wrangler.jsonc` with the D1 binding `DB` | ✅ in the repo |
| Build (`npm run build` → `dist/`) and end-to-end test | ✅ passing locally on the Cloudflare runtime |

What could not be done from here: creating the Pages project, setting the secret, and the DNS
change. Those need your Cloudflare dashboard (or an API token) and your Netlify DNS.

## Step 1 — Create the Pages project (about 3 minutes)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Choose the repository `ai-igorbotelho-studio/25bcalaistce`.
3. Settings:
   - Project name: `25bcalais`
   - Production branch: `main` (merge this work into `main` first, or select the working branch)
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
4. **Save and Deploy.** The D1 binding is read from `wrangler.jsonc` automatically.
   Check it under **Settings → Bindings**: `DB` → `calais-25b`.

## Step 2 — Set the edit password (required for EDIT mode)

**Settings → Variables and Secrets → Add** → type **Secret**:

| Name | Value |
|---|---|
| `EDIT_PASSWORD` | the shared house password you agreed with Sarah, Dave and Flavia |
| `SESSION_SECRET` | any long random string (recommended — e.g. output of `openssl rand -hex 32`) |

Then **Deployments → … → Retry deployment** so the secret takes effect.

Without this secret the page still works read-only, but nobody can edit.
Changing the secret later signs everyone out immediately.

## Step 3 (optional) — Import the data from the old Supabase site

The old site saved its tasks, comments and photos in Supabase. To bring them over **before
anyone edits on the new site**:

1. Supabase → Project settings → API → copy the **service_role** key.
2. Cloudflare Pages → Settings → Variables and Secrets → add Secret
   `SUPABASE_SERVICE_ROLE_KEY` with that value, then redeploy.
3. Open the site once. On first load the database is empty, so it imports the Supabase row
   (photos are moved into D1 automatically).
4. Delete the `SUPABASE_SERVICE_ROLE_KEY` secret afterwards — it is no longer needed.

> The import only runs while the D1 `state` table is empty. If the new site has already been
> opened without the key, empty it first: D1 → `calais-25b` → Console →
> `DELETE FROM state;` then reload the page.

## Step 4 — Point the domain at Cloudflare

`igorbotelho.com` uses **Netlify DNS** (nameservers `dns1–4.p07.nsone.net`). Cloudflare Pages
supports a custom **subdomain** on external DNS through a CNAME, so only this one record changes:

1. Cloudflare Pages → project `25bcalais` → **Custom domains** → **Set up a custom domain** →
   `25bcalais.igorbotelho.com`. Cloudflare shows the CNAME target (`25bcalais.pages.dev`).
2. Netlify → the old site → **Domain management** → remove `25bcalais.igorbotelho.com` from that site.
3. Netlify → **Domains** → `igorbotelho.com` → **DNS records** → add:
   `CNAME  25bcalais  →  25bcalais.pages.dev`
4. Back in Cloudflare, wait for the domain to show **Active** (SSL is issued automatically,
   usually within minutes).

**Rollback:** delete the CNAME in Netlify and re-attach the domain to the Netlify site.

> Alternative: move the whole `igorbotelho.com` zone to Cloudflare (change nameservers at the
> registrar). That moves every other subdomain too, so it is a separate decision.

## Deploying from the command line (alternative)

```bash
npx wrangler login              # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npm run deploy                  # builds and runs: wrangler pages deploy dist --project-name 25bcalais
npx wrangler pages secret put EDIT_PASSWORD --project-name 25bcalais
```

## Brute-force protection

The app blocks an IP after 10 wrong passwords in 15 minutes (table `login_attempts`). Because the
house password is short, an edge rate-limiting rule on `/api/login` would be stronger — but WAF
rules need the domain's zone on Cloudflare. While `igorbotelho.com` stays on Netlify DNS, the
built-in limit is the protection; if the zone moves to Cloudflare later, add a rate-limiting rule
(`URI Path equals /api/login`, 5 requests per minute per IP, Block).

## Database migrations

The schema in `migrations/` was applied to the remote database by hand. Running
`npx wrangler d1 migrations apply calais-25b --remote` later is safe (all statements use
`IF NOT EXISTS`) and records them in wrangler's migration table.

## After go-live

- The old Netlify site and the Supabase project can be retired once you have checked the data.
  Both contain personal data (emails, profiles, photos) — delete them deliberately, not by accident.
- Accounts on the old Supabase site were created with a default password that was visible in the
  public page source. If the Supabase project stays alive, rotate or delete those accounts.
