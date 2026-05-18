# Enviroworx Cloud

All-in-one business operations platform for Enviroworx Ltd. Built on Next.js with Supabase, handling bookings, dispatch, driver mobile workflows, customer invoicing, fleet tracking, and reporting.

## Stack Overview

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Integrations:**
  - **Stripe** — payment processing
  - **Twilio** — SMS driver notifications
  - **QuickBooks** — accounting sync
  - **Verizon Fleetmatics** — fleet tracking
  - **Google Drive** — KML boundary imports

## Route Structure

| Route | Audience | Purpose |
|-------|----------|---------|
| `/office` | Office staff | Dashboard (bookings, dispatch, invoicing, fleet, reports) |
| `/portal` | Customers | View invoices and make payments |
| `/driver` | Drivers | Job list, clock-in, job completion, break timer |
| `/tablet` | Yard staff | Yard / weighbridge tablet interface |

## Local Development Setup

```bash
# Clone the repository
git clone <repo-url>
cd enviroworx-cloud

# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Fill in your Supabase keys in .env.local:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY

# Run the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Required Environment Variables

Copy `.env.local.example` to `.env.local` and provide values for all variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (`https://<PROJECT_ID>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access — keep secret) |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID (for SMS notifications) |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | Twilio phone number to send SMS from |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (for address lookup) |

> **Security note:** Never commit `.env.local` or any file containing real credentials. The file is already listed in `.gitignore`.

## Schema Setup

Apply the migrations in `supabase/migrations/` **in filename order** using the Supabase SQL Editor or `psql`:

```bash
# Example using psql — run each file in order:
psql $DATABASE_URL -f supabase/migrations/001_schema.sql
psql $DATABASE_URL -f supabase/migrations/20260404000000_add_telemetry.sql
psql $DATABASE_URL -f supabase/migrations/20260404000001_add_kml_points.sql
psql $DATABASE_URL -f supabase/migrations/20260504000000_add_missing_tables.sql
psql $DATABASE_URL -f supabase/migrations/20260504000000_fix_schema.sql
```

Alternatively, run each migration through the Supabase Dashboard SQL Editor.

## Build

```bash
npm run build
```

## ⚠️ Security Warning

**`.env.local.example` previously contained example Twilio credentials (Account SID, Auth Token, and from-number).** These were placeholder values intended for documentation only. If you have deployed this application using credentials derived from or identical to the example values, **rotate all Twilio tokens immediately** via the [Twilio Console](https://www.twilio.com/console).

General security reminders:
- Never commit secrets or API keys to version control.
- Rotate credentials periodically and after any team member changes.
- Restrict Supabase service role keys to server-side code only.

## Deployment Notes

- Deploy on **Vercel** (`vercel --prod` or connect the Git repo for auto-deploys).
- Add **all environment variables** listed above in the Vercel project settings before the first deploy.
- Ensure Supabase migrations are applied to the production database before deploying.
- Verify Stripe webhook endpoints are configured for the production domain.

## Customer ID Migration (Phase 9)

### Status: In Progress

The application is migrating from loose `ilike(customer_name, ...)` matching to proper `customer_id` foreign key joins. This ensures reliable customer history even when names have variations ("Ltd" vs "Limited", trailing spaces, etc.).

### Migration Steps
1. Apply migration `20260518000002_customer_id_backfill.sql` -- backfills `orders.customer_id`, `cash_log.customer_id`, and `weight_logs.customer_id`
2. Run review script `supabase/scripts/review_customer_id_backfill.sql` to check match quality
3. Manually fix any unmatched rows (customers with name variations)
4. Uncomment the NOT NULL constraints in `20260518000003_enforce_customer_id_not_null.sql`
5. Apply the NOT NULL enforcement migration

### Rollback
- To rollback, simply restore the commented-out ilike-based queries from the pre-Phase 9 backup
- The `customer_name` column is preserved for reference and search purposes

---

*Copyright (c) 2026 Enviroworx Ltd. All rights reserved.*
