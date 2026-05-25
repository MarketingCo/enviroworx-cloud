# Enviroworx Cloud — Quick start (2026 handover)

## Live URLs

| App | Path | Auth |
|-----|------|------|
| Marketing site | `/` | Public |
| **Office** | `/office/login` | Google (company account) |
| Driver PWA | `/driver` | Name + PIN |
| Customer portal | `/portal` | Name + portal PIN |
| Yard tablet | `/tablet` | Yard PIN |
| Health check | `/api/health` | Public |

Full handover checklist: **`docs/HANDOVER.md`**  
Staff how-to: **`docs/STAFF_GUIDE.md`**

---

## 1. Supabase (15 min)

1. Create project at [supabase.com](https://supabase.com) (UK region).
2. Run SQL migrations in `supabase/migrations/` (oldest first), including **`20260520000000_platform_hardening.sql`**.
3. **Storage:** bucket `job-photos` for driver proof photos.
4. **Auth → Google** enabled; redirect URL: `https://YOUR-DOMAIN/auth/callback`.
5. Insert office users into `office_staff` (see `docs/HANDOVER.md`).

---

## 2. Environment variables

Copy `.env.local.example` → `.env.local` (and set the same in **Vercel**).

**Required:** `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `OFFICE_GOOGLE_ALLOWED_DOMAINS`

**Optional:** `GOOGLE_MAPS_API_KEY`, Twilio, Stripe, `CRON_SECRET`, `MONITORING_WEBHOOK_URL`

---

## 3. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/office/login`

---

## 4. Deploy (Vercel)

1. Push `main` (after merging `cursor/office-google-auth`).
2. Import repo in Vercel; add all env vars.
3. Add `CRON_SECRET` — Vercel crons call `/api/cron/*` with `Authorization: Bearer <CRON_SECRET>`.
4. Verify deploy: `GET https://YOUR-DOMAIN/api/health` → `"ok": true`.

---

## 5. Data migration (optional)

If moving from Excel / Sheets:

```bash
npm run migrate
```

---

## 6. PIN setup

In Supabase Table Editor:

- `drivers.pin` — each driver (4 digits)
- `customers.portal_pin` — each portal customer
- `yard_staff.pin` — yard clock

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Office redirect loop | Google allowlist + `office_staff` row + Supabase redirect URL |
| Empty Customers/Reports | Sign in to office; data loads via server actions |
| Maps autocomplete | Enable Places API; set `GOOGLE_MAPS_API_KEY` |
| SEPA Drive sync fails | Google Drive API credentials in `drive` actions |
| Driver photo fail | Create `job-photos` storage bucket |
| Portal pay fails | Stripe keys + webhook to `/api/stripe/webhook` |

---

## Monthly cost (estimate)

Supabase Pro + Vercel Pro + SMS usage ≈ **£50–80/month** (excluding Stripe fees).
