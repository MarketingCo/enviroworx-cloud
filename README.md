# Enviroworx Cloud

Next.js operations platform for skip hire, dispatch, weighbridge, and customer portal.

**Stack:** Vercel (hosting) + Supabase (database, auth, storage)

## Quick links

| Doc | Purpose |
|-----|---------|
| [docs/HANDOVER.md](docs/HANDOVER.md) | Go-live checklist for client handover |
| [docs/STAFF_GUIDE.md](docs/STAFF_GUIDE.md) | Daily use for office, drivers, customers |
| [DEPLOYMENT_QUICK_START.md](DEPLOYMENT_QUICK_START.md) | Deploy in ~15 minutes |

## Apps

| URL | Users |
|-----|-------|
| `/office/login` | Office staff (Google) |
| `/driver` | Drivers (PIN) |
| `/portal` | Customers (PIN) |
| `/tablet` | Yard clock (PIN) |
| `/api/health` | Uptime monitoring |

## Development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev
```

```bash
npm run typecheck
npm run lint
npm run build
```

## Not Railway

This repo deploys to **Vercel**, not Railway. Database is **Supabase** (separate service). If an old Railway project exists, retire it to avoid duplicate deploys.
