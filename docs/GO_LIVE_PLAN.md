# EnviroWorx Cloud — Go-Live Plan (handover for an AI assistant)

> **Purpose:** Take the app from "code complete" to "live and signed-in".
> The code is already on `main`. **Every remaining task is configuration**, not coding.
>
> **Legend:**
> - 🤖 = the AI assistant can do this (terminal / scripts / code).
> - 👤 = **only Iain can do this** (logging into web dashboards, fetching API keys, OAuth consent). The AI must STOP and ask Iain to do these, then wait.
> - ✅ = verification step. Do not move to the next phase until the ✅ passes.
>
> **Golden rules for the AI:**
> 1. Never print or commit secrets. `.env.local` and `.env.vercel.*` must stay out of git.
> 2. Do not `git push` to `main` directly — open a PR.
> 3. After every change, run the relevant ✅ verify step and report the output verbatim.
> 4. If a 👤 step is not done yet, stop and ask Iain — do not fake or skip it.
>
> Project ref (Supabase): `iuodjkeygsqthlpfjkwj`
> Production URL: `https://enviroworx-cloud.vercel.app`
> Working dir: `/Users/iainmartin_macbook_air/Proserve_apps/enviroworx-cloud`

---

## Decisions (locked — do NOT change these)

- **Office login = Google only**, restricted to two accounts:
  - `accounts@enviroworx.co.uk` → role `admin`
  - `info@enviroworx.co.uk` → role `office`
  These are exactly the defaults already in `scripts/seed-office-staff.mjs` — do not edit the script.
- **Driver login stays name + lorry + 4-digit PIN.** Do **not** convert drivers to
  email/password — it was considered and rejected (in-cab usability + the offline
  job queue depends on the current PIN/JWT session). Leave
  `src/app/api/auth/driver/route.ts` and the `/driver` login flow as they are.
  The only driver task is data: give **each driver their own unique 4-digit PIN**
  in Supabase → Table Editor → `drivers.pin`.

---

## Phase 0 — Baseline & repo hygiene 🤖

**0.1 Confirm where we are.**
```bash
git status
git checkout cursor/office-google-auth
npm run preflight
```
Record the preflight output. This is the "before" snapshot.

**0.2 Remove committed junk/large files from git tracking** (they stay on disk, just leave the repo). These are currently tracked and shouldn't be:
```bash
git rm --cached "Enviroworx.xlsx" "data.xlsx" "Enviroworx (3).kml" \
  "build_log.txt" "dev_output.txt" "next" "enviroworx-cloud@1.0.0" "package-lock 2.json" 2>/dev/null || true
```
Then add them to `.gitignore` so they don't come back:
```
# Local data / scratch (added during go-live cleanup)
*.xlsx
*.kml
build_log.txt
dev_output.txt
package-lock 2.json
/next
/enviroworx-cloud@1.0.0
```
> ⚠️ Keep `package-lock.json` (the real one) tracked. Only ignore the stray `package-lock 2.json`.

**0.3 Commit the cleanup** on the current branch (do NOT push to main):
```bash
git add .gitignore
git commit -m "chore: stop tracking large data files and stray scratch files"
```

**✅ 0.4** `git status` is clean and `git ls-files | grep -Ei '\.xlsx|\.kml'` returns nothing.

---

## Phase 1 — Database readiness

**1.1 🤖 Confirm migrations are applied.** The schema lives in `supabase/migrations/`. The key one for office roles is `20260520000000_platform_hardening.sql`. Check the tables exist:
```bash
npm run preflight
```
The "Database (service role)" section should show `✓ config table`, `✓ drivers`, `✓ customers`. If `office_staff` errors with "relation does not exist", the platform-hardening migration was never run → go to 1.2. If it just says "empty", skip to 1.3.

**1.2 👤 (only if `office_staff` table is missing)** Iain runs the migration in the Supabase SQL Editor:
- Open https://supabase.com/dashboard/project/iuodjkeygsqthlpfjkwj/sql
- Paste and run the contents of `supabase/migrations/20260520000000_platform_hardening.sql`.
- (Reference SQL is also in `docs/ENABLE_GOOGLE_AUTH.md` §5.)

**1.3 🤖 Seed office staff** — these are the email addresses allowed to sign into `/office`.
> ⚠️ **Ask Iain first:** "Which Google email addresses should have office access, and what role each (`admin` / `office` / `dispatch`)?" The default script seeds `accounts@enviroworx.co.uk` (admin) and `info@enviroworx.co.uk` (office). Edit `scripts/seed-office-staff.mjs` `rows` array to match Iain's real accounts **before** running.
```bash
node scripts/seed-office-staff.mjs
```

**✅ 1.4** `npm run preflight` now shows `✓ office_staff (N active)`.

**1.5 👤 Storage bucket** (needed for driver job photos). Iain creates a bucket named **`job-photos`** in Supabase → Storage (public read if drivers share proof URLs). Reference: `docs/HANDOVER.md` §1.A.2.

---

## Phase 2 — Enable Google sign-in 👤 (HUMAN ONLY — the AI cannot do this)

> This is the #1 blocker. It is pure dashboard work across Google Cloud + Supabase. The AI's job here is to **hand Iain the exact instructions, then wait and verify.** Full detail already exists in `docs/ENABLE_GOOGLE_AUTH.md`. Summary:

**2.1 Google Cloud Console** → APIs & Services → Credentials → Create OAuth client ID → **Web application**. Authorized redirect URI (exactly):
```
https://iuodjkeygsqthlpfjkwj.supabase.co/auth/v1/callback
```
Copy the **Client ID** and **Client Secret**.

**2.2 Supabase** → Authentication → Providers → **Google** → Enable → paste Client ID + Secret → Save.

**2.3 Supabase** → Authentication → URL Configuration:
- Site URL: `https://enviroworx-cloud.vercel.app`
- Redirect URLs (add both):
  - `https://enviroworx-cloud.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

**✅ 2.4 🤖** After Iain confirms, the AI verifies:
```bash
npm run preflight
```
Must show `✓ Google appears enabled`. (Before this, it shows `✗ Google NOT enabled (400)`.)

> **Why this matters:** `src/app/auth/callback/route.ts` exchanges the Google code, then calls `lookupOfficeStaff(email)`. If the email is not in `office_staff` (Phase 1) it signs them straight back out with `?error=forbidden`. So Phase 1 **and** Phase 2 must both be done for login to work.

---

## Phase 3 — Environment variables

**3.1 👤 Fetch the keys Iain wants live:**
- **`GOOGLE_MAPS_API_KEY`** — Google Cloud Console → enable **Places API** + **Geocoding API**, create an API key. Powers address autocomplete in new bookings. *(Recommended.)*
- **`STRIPE_SECRET_KEY`** + **`STRIPE_WEBHOOK_SECRET`** — Stripe dashboard. Only needed if customers pay through `/portal` now. *(Optional — can defer.)*
- **`TWILIO_*`** — only if driver SMS is going live now. *(Optional.)*

**3.2 🤖 Put them in `.env.local`** (never commit). Then verify locally:
```bash
npm run preflight
```
The previously-`✗` keys should flip to `✓`.

**3.3 🤖 Sync to Vercel** (production + preview) using the existing helper:
```bash
./scripts/sync-vercel-env.sh
```
> Note: this script pushes `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `OFFICE_GOOGLE_ALLOWED_DOMAINS`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_MAPS_API_KEY`, `TWILIO_*`. It does **not** push Stripe — if Stripe is going live, add those two manually:
```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```
Also confirm `CRON_SECRET` exists on Vercel (required for the 3 cron jobs in `vercel.json`).

**✅ 3.4 🤖** `vercel env ls` shows all required vars in **production**.

---

## Phase 4 — Merge & deploy

**4.1 🤖 Open a PR** for the go-live tooling branch (don't merge locally):
```bash
git push -u origin cursor/office-google-auth
gh pr create --base main --head cursor/office-google-auth \
  --title "Go-live diagnostics + repo cleanup" \
  --body "Preflight tooling, env sync, office_staff seed, and removal of large tracked data files."
```
**4.2 👤** Iain reviews and merges the PR on GitHub.

**4.3 🤖** Vercel auto-deploys from `main` on merge. Confirm the production deployment succeeded (`vercel ls` or the Vercel dashboard).

**✅ 4.4 🤖 Health check:**
```bash
curl -s https://enviroworx-cloud.vercel.app/api/health
```
Must return `{"ok":true, ... "db":true ...}`.

---

## Phase 5 — Smoke test (👤 Iain drives, ~15 min)

Use the checklist already in `docs/HANDOVER.md` §3. Minimum to call it live:
- [ ] `/office/login` → "Continue with Google" → dashboard loads with real numbers.
- [ ] Office → Customers search → open a timeline.
- [ ] Office → New booking → address autocomplete works (proves `GOOGLE_MAPS_API_KEY`).
- [ ] Office → Dispatch → assign a driver.
- [ ] Office → Sign out works.
- [ ] `/driver` → PIN login → clock in → photo → complete a job.
- [ ] Driver offline test: turn off Wi-Fi → complete a job → Wi-Fi back on → it syncs.
- [ ] `/portal` → customer PIN → view orders (→ Stripe pay if configured).
- [ ] Vercel → cron logs show the scheduled jobs running.

> PINs are set in Supabase Table Editor: `drivers.pin`, `customers.portal_pin`, `yard_staff.pin` (4 digits each). See `docs/HANDOVER.md` §4.

---

## Phase 6 — Security & dependency follow-up 🤖 (after go-live)

There are 3 open Dependabot PRs. Handle in this order, each on its own and verified with `npm run build`:
1. **`ws` 8.20→8.21** and **`qs` 6.15.0→6.15.2** — patch-level security bumps, low risk. Merge first.
2. **`next` 14.2.35 → 15.5.18** — **major upgrade, do NOT blind-merge.** Next 15 changes async request APIs (cookies/headers) and caching defaults. Do this on a branch, run `npm run build` + `npm run typecheck`, smoke-test office login locally, only then merge. The Vercel `next-upgrade` guidance/codemods can help.

> Known limitations to keep visible (from `docs/HANDOVER.md` §5): rate limits are per-instance (not a global WAF); offline driver queue covers "complete"/"on site" only; QuickBooks sync needs live QB OAuth env vars.

---

## Quick reference — who can sign in where

| Surface | URL | Login | Gated by |
|---|---|---|---|
| Office | `/office/login` | Company Google account | `office_staff` table (Phase 1) + Google enabled (Phase 2) |
| Drivers | `/driver` | Name + lorry + 4-digit PIN | `drivers.pin` |
| Customers | `/portal` | Account name + portal PIN | `customers.portal_pin` |
| Yard tablet | `/tablet` | Yard staff PIN | `yard_staff.pin` |

## Definition of done
- `npm run preflight` shows ✓ for: all env, **Google enabled**, **office_staff ≥1**, db tables, production health.
- `curl .../api/health` → `ok:true`.
- Iain can sign into `/office` with Google and see the dashboard.
- Go-live branch merged to `main`; large files no longer tracked.
