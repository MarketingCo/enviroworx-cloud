# Enviroworx Cloud — Wednesday handover checklist

**Target:** Production-ready operations app for office, drivers, customers, and yard.  
**Branch:** `cursor/office-google-auth` (merge to `main` before go-live).

---

## 1. Go-live sequence (do in order)

### A. Database (Supabase)

1. Open **SQL Editor** → run migrations in order (if not already applied):
   - `supabase/migrations/001_schema.sql` (or `SCHEMA_FOR_PASTING.sql`)
   - Later migrations in `supabase/migrations/` by date
   - **`20260520000000_platform_hardening.sql`** — office staff roles + audit columns
2. **Storage:** Create bucket `job-photos` (public read if drivers need proof URLs).
3. **Auth → Providers:** Enable **Google**, add OAuth client from Google Cloud.
4. **Auth → URL configuration:**
   - Site URL: `https://YOUR-PRODUCTION-DOMAIN`
   - Redirect URLs: `https://YOUR-PRODUCTION-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`

### B. Office staff access

```sql
INSERT INTO office_staff (email, display_name, role, active)
VALUES
  ('admin@yourcompany.co.uk', 'Office Admin', 'admin', true),
  ('dispatcher@yourcompany.co.uk', 'Dispatcher', 'dispatch', true);
```

Roles: `admin` | `office` | `dispatch`.  
Fallback: `OFFICE_GOOGLE_ALLOWED_DOMAINS` in Vercel still works if table is empty (not recommended in production).

### C. Vercel environment variables

Copy from `.env.local.example`. **Required:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server actions / cron |
| `SESSION_SECRET` | Driver/portal PIN sessions |
| `CRON_SECRET` | Vercel cron auth |
| `OFFICE_GOOGLE_ALLOWED_DOMAINS` | Who can sign into office |

**Recommended:** `GOOGLE_MAPS_API_KEY`, `TWILIO_*`, `STRIPE_*`, `STRIPE_WEBHOOK_SECRET`, `MONITORING_WEBHOOK_URL`

### D. Deploy

1. Merge PR `cursor/office-google-auth` → `main`
2. Vercel production deploy from `main`
3. Confirm **`GET /api/health`** returns `"ok": true`

---

## 2. URLs to give the client

| Who | URL | Login |
|-----|-----|--------|
| Office | `/office/login` | Company Google account |
| Drivers | `/driver` | Name + lorry + 4-digit PIN |
| Customers | `/portal` | Account name + portal PIN |
| Yard tablet | `/tablet` | Yard staff PIN |

Staff guide: `docs/STAFF_GUIDE.md`

---

## 3. Smoke test (15 minutes)

- [ ] Office: Google sign-in → Dashboard loads numbers
- [ ] Office: Customers search → open timeline → Mark paid (if unpaid)
- [ ] Office: New booking + address autocomplete (needs Maps key)
- [ ] Office: Dispatch assign driver
- [ ] Office: Reports → download CSV + **Sync SEPA to Google Drive** (needs Google Drive API configured)
- [ ] Office: Activity tab shows recent actions
- [ ] Office: Sign out works
- [ ] Driver: Clock in → On site → Photo + Skip ID → Complete
- [ ] Driver: Turn off Wi‑Fi → complete queues → Wi‑Fi on → syncs
- [ ] Portal: Login → view orders → pay with Stripe (if configured)
- [ ] Cron: Vercel shows successful runs for reminders / Verizon (if keys set)

---

## 4. Driver & customer PINs

Set in Supabase **Table Editor**:

- `drivers.pin` — 4 digits per driver
- `customers.portal_pin` — 4 digits per customer portal user
- `yard_staff.pin` — yard tablet

**Do not** enable `OFFICE_PIN_AUTH_ENABLED` in production unless you need a backup to Google.

---

## 5. Known limitations (be transparent)

- Rate limits are per server instance (not global WAF).
- Offline driver queue: **complete** and **on site** only; abort still needs network.
- QuickBooks sync needs live QB OAuth env vars.
- Dependabot may report npm vulnerabilities — schedule a dependency pass after handover.
- Monthly SEPA cron still requires `CRON_SECRET` on Vercel; office **Reports** button uses authenticated server action (no cron secret needed).

---

## 6. Support contacts

- **Supabase:** project dashboard → logs / API
- **Vercel:** deployment logs, env vars, cron logs
- **Twilio / Stripe:** respective dashboards for SMS and payments

---

## 7. Post-handover (optional)

- Merge `main` and tag release `v1-handover`
- Run `npm run migrate` if historical Excel data not yet imported
- Plan digital waste tracking (SEPA 2026) per business roadmap
