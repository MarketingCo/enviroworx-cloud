-- Office staff roles (Google email → role)
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

-- Richer audit trail on activity_log
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS actor_email TEXT,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_activity_log_created_desc
  ON public.activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_actor
  ON public.activity_log (actor_email);

-- Seed example row (optional — comment out in prod if undesired)
-- INSERT INTO public.office_staff (email, display_name, role)
-- VALUES ('you@yourcompany.co.uk', 'Admin', 'admin')
-- ON CONFLICT DO NOTHING;
