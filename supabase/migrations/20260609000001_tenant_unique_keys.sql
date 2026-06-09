-- ============================================================
-- PER-TENANT UNIQUE KEYS
-- ============================================================
-- Remaining business keys that were still globally unique. With a
-- second tenant these would block (or leak the existence of) the
-- first tenant's emails, driver PINs, and skip numbers.
-- Idempotent: safe on live and fresh databases.

DO $$
BEGIN
  -- customers: email unique per tenant, not globally
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_email_key') THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_email_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_tenant_email_key') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_tenant_email_key UNIQUE (tenant_id, email);
  END IF;

  -- drivers: PIN unique per tenant
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_pin_code_key') THEN
    ALTER TABLE public.drivers DROP CONSTRAINT drivers_pin_code_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_tenant_pin_code_key') THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_tenant_pin_code_key UNIQUE (tenant_id, pin_code);
  END IF;

  -- skips: skip number unique per tenant
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skips_skip_id_key') THEN
    ALTER TABLE public.skips DROP CONSTRAINT skips_skip_id_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skips_tenant_skip_id_key') THEN
    ALTER TABLE public.skips ADD CONSTRAINT skips_tenant_skip_id_key UNIQUE (tenant_id, skip_id);
  END IF;
END $$;
