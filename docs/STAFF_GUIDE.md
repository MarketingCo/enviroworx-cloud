# Enviroworx Cloud — Staff guide

## Office (`/office/login`)

1. Open **Continue with Google** with your company account.
2. Your email must be on the allowlist (`OFFICE_GOOGLE_ALLOWED_DOMAINS` / `OFFICE_GOOGLE_ALLOWED_EMAILS` in Vercel) or in the **`office_staff`** table in Supabase.
3. Use tabs: **Dashboard**, **Dispatch**, **Weighbridge**, **New Booking**, **Customers**, **Reports**, **Activity** (audit log), **Settings**.
4. **Sign out** when finished (top right).

Optional PIN login only works if `OFFICE_PIN_AUTH_ENABLED=true` (not recommended in production).

## Driver app (`/driver`)

1. Select your name, lorry, and 4-digit PIN → **Clock in**.
2. Tap **I'm on site** when you arrive (customer gets an SMS if Twilio is configured).
3. Use **Navigate** (Waze / Google / Apple Maps).
4. Take a **proof photo**, enter **Skip ID**, then **Complete job**.
5. **Abort** only if the job cannot be done (customer can be notified).
6. **Clock out** when your route is finished.

## Customer portal (`/portal`)

Customers sign in with **account name + portal PIN** (set in Supabase `customers.portal_pin`).

They can view orders, weighbridge history, request collections, and pay outstanding balances (if Stripe is configured).

## Yard tablet (`/tablet`)

Yard staff clock in/out with name + PIN (yard_staff table).

## If something breaks

- **Can't sign in to office:** Check Google allowlist and Supabase Auth redirect URL `https://YOUR_DOMAIN/auth/callback`.
- **Empty customers/reports:** Sign in again; data loads via authenticated server actions.
- **Health check:** `GET /api/health` should return `"ok": true` when the database is reachable.

## Customers (duplicates)

On **Customers**, amber boxes show possible duplicate accounts. Choose the **primary** record and click **Merge** — orders and weighbridge history are moved to that name.

## Reports

The top row shows **cash, tonnage, jobs completed, and unpaid invoices** for the selected date range before you export CSVs.

## Driver offline mode

If the driver loses signal, **Complete** and **On site** are queued on the device and sync automatically when back online.

## Admin setup checklist

- [ ] Run Supabase migration `20260520000000_platform_hardening.sql`
- [ ] Add rows to `office_staff` for each office user (role: `admin`, `office`, or `dispatch`)
- [ ] Enable Google provider in Supabase Auth
- [ ] Set Vercel env: Supabase keys, `SESSION_SECRET`, allowlist domains, Twilio (optional), Stripe (optional)
- [ ] Optional: `MONITORING_WEBHOOK_URL` for error alerts
