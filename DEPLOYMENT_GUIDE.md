# Enviroworx Cloud — Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables (Vercel)

Set ALL of these in Vercel Project Settings > Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook endpoint secret |
| `CRON_SECRET` | Yes | Random secret for cron auth (generate with `openssl rand -hex 32`) |
| `PIN_SECRET` | Yes | Secret for driver PIN hashing (change from default!) |
| `TWILIO_ACCOUNT_SID` | No* | Twilio account SID (*required for SMS) |
| `TWILIO_AUTH_TOKEN` | No* | Twilio auth token (*required for SMS) |
| `TWILIO_FROM_NUMBER` | No* | Twilio sending number (*required for SMS) |
| `QB_CLIENT_ID` | No* | QuickBooks client ID (*required for QB) |
| `QB_CLIENT_SECRET` | No* | QuickBooks client secret (*required for QB) |
| `QB_REDIRECT_URI` | No* | QB OAuth callback URL (*required for QB) |
| `QB_SANDBOX` | No | `true` for sandbox, `false` (or omit) for production |
| `VERIZON_*` | No* | Verizon Fleetmatics credentials (*required for fleet sync) |
| `GOOGLE_*` | No* | Google Maps API key, Drive service account (*required for KML/maps) |
| `SENTRY_DSN` | No | Sentry DSN (activate in Phase 8) |

### 2. Supabase Migrations — Apply in Order

Apply these migrations in EXACT order via Supabase SQL Editor or CLI:

```bash
# Using Supabase CLI
supabase db push --dry-run  # Verify first
supabase db push            # Apply
```

Migration order:
1. `001_schema.sql` — Core tables, indexes, enums
2. `20260404000000_add_telemetry.sql` — Telemetry
3. `20260404000001_add_kml_points.sql` — KML points
4. `20260504000000_add_missing_tables.sql` — Additional tables
5. `20260504000001_fix_schema.sql` — Schema fixes
6. `20260518000000_auth_system.sql` — Auth system (pin_hash, auth_user_id, roles)
7. `20260518000001_rls_policies.sql` — RLS policies
8. `20260518000002_customer_id_backfill.sql` — Backfill customer_id FKs

### 3. Backfill PIN Hashes

Run this SQL to generate PIN hashes for existing users (or do it via the app):

```sql
-- This is a placeholder — implement proper bcrypt hashing via the app
-- The driver/tablet login APIs will fall back to plaintext pin during transition
```

### 4. Configure Stripe

1. In Stripe Dashboard, create a webhook endpoint pointing to `https://enviroworx.co.uk/api/stripe/webhook`
2. Select events: `checkout.session.completed`
3. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
4. Set `STRIPE_SECRET_KEY` to your live secret key

### 5. Configure QuickBooks (Optional)

1. Create app at https://developer.intuit.com/
2. Set `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_REDIRECT_URI`
3. Set `QB_SANDBOX=false` for production
4. In the app, click "Connect QuickBooks" to authorize

### 6. DNS

Point `enviroworx.co.uk` A record to Vercel:
```
A     enviroworx.co.uk     76.76.21.21
CNAME www                  cname.vercel-dns.com
```

### 7. Vercel Cron Configuration

The `vercel.json` includes cron schedules. After first deploy, verify in Vercel Dashboard > Cron Jobs.

### 8. Smoke Test

After deploy, verify all routes:
- [ ] `https://enviroworx.co.uk/` — Landing page loads
- [ ] `https://enviroworx.co.uk/office/login` — Login page loads
- [ ] `https://enviroworx.co.uk/portal` — Customer portal loads
- [ ] `https://enviroworx.co.uk/driver` — Driver app loads
- [ ] `https://enviroworx.co.uk/tablet` — Tablet app loads
- [ ] `https://enviroworx.co.uk/api/health` — Returns 200 + DB connected
- [ ] `https://enviroworx.co.uk/api/cron/verizon-sync` — Returns 401 without secret
- [ ] `https://enviroworx.co.uk/api/cron/monthly-sepa` — Returns 401 without secret
- [ ] `https://enviroworx.co.uk/api/cron/collection-reminders` — Returns 401 without secret
- [ ] Stripe test payment completes successfully
- [ ] QB sync creates a Draft invoice (if QB configured)
- [ ] Driver PWA works offline (enable airplane mode after load)

## Post-Deployment

### Enable Strict RLS
After verifying the app works, apply:
```sql
-- From 20260518000001_rls_policies.sql
-- All policies are already in place, RLS is enabled on 18 tables
```

### Clean Up
1. Remove old `pin` columns after confirming PIN migration works:
   Uncomment the DROP COLUMN lines in migration 20260518000000

2. Enforce NOT NULL on customer_id after backfill review:
   Uncomment and apply `20260518000003_enforce_customer_id_not_null.sql`

3. Run customer_id review script:
   ```sql
   \i supabase/scripts/review_customer_id_backfill.sql
   ```

### Monitoring
- Check `/api/health` endpoint periodically (configure uptime monitor)
- Monitor Vercel Analytics for performance
- Monitor Stripe Dashboard for payment events
- Review `activity_log` table for admin actions
