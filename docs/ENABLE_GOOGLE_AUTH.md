# Enable Google sign-in (one-time)

Your Supabase project ref: **`iuodjkeygsqthlpfjkwj`** (from linked CLI).

## 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. **Create credentials → OAuth client ID** → **Web application**
3. **Authorized redirect URIs** — add exactly:

   ```
   https://iuodjkeygsqthlpfjkwj.supabase.co/auth/v1/callback
   ```

4. Copy **Client ID** and **Client Secret**

## 2. Supabase Dashboard

1. [Supabase](https://supabase.com/dashboard/project/iuodjkeygsqthlpfjkwj) → **Authentication → Providers → Google**
2. **Enable** Google
3. Paste Client ID + Client Secret → **Save**

## 3. Supabase URL configuration

**Authentication → URL Configuration:**

| Field | Value |
|--------|--------|
| Site URL | `https://enviroworx-cloud.vercel.app` |
| Redirect URLs | `https://enviroworx-cloud.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

## 4. Verify

```bash
npm run preflight
```

You should see: `✓ Google appears enabled`

Then open: **https://enviroworx-cloud.vercel.app/office/login** → **Continue with Google**

Any `@enviroworx.co.uk` Google account is allowed when `OFFICE_GOOGLE_ALLOWED_DOMAINS=enviroworx.co.uk` is set on Vercel.

## 5. Optional: `office_staff` table

If login works but you want named roles, run in **SQL Editor**:

```sql
-- From supabase/migrations/20260520000000_platform_hardening.sql (if table missing)
CREATE TABLE IF NOT EXISTS public.office_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'office'
    CHECK (role IN ('admin', 'office', 'dispatch')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_office_staff_email_lower
  ON public.office_staff (lower(trim(email)));
```

Then: `node scripts/seed-office-staff.mjs`
