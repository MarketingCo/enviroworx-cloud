-- ============================================================
-- MULTI-TENANCY — CODIFIED
-- ============================================================
-- The tenancy schema was originally applied directly to the live
-- database (2026-06-08). This migration captures it as code so a
-- fresh database (a new customer instance, or a rebuild) reaches
-- the same state. Safe to re-run on the live database: every
-- statement is idempotent.
--
-- Tenant #1 (Enviroworx) keeps a fixed UUID so column defaults,
-- backfills, and seed scripts agree across environments.
-- ============================================================

-- 1. Tenants table ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.tenants (id, slug, company_name)
VALUES ('56ec5b3f-6d42-4672-a98c-d60d9c22f284', 'enviroworx', 'Enviroworx')
ON CONFLICT (slug) DO NOTHING;

-- Onboarding checklist rows for new tenants (created live; codified here)
CREATE TABLE IF NOT EXISTS public.tenant_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, step)
);

-- 2. tenant_id on every operational table -------------------------
-- Default = Enviroworx so existing single-tenant writes keep working;
-- the app layer always sets tenant_id explicitly from the session.
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'active_tippers', 'activity_log', 'archive_orders', 'carrier_licences',
    'cash_log', 'config', 'custom_pricing', 'customers', 'driver_hours',
    'drivers', 'fleet_logs', 'fuel_cards', 'hr_logs', 'incidents',
    'inventory', 'lorries', 'maintenance_logs', 'office_staff', 'orders',
    'permits', 'shifts', 'skip_combos', 'tare_weights', 'vehicle_checks',
    'vehicle_maintenance', 'vehicle_telemetry', 'vehicles',
    'walkaround_checks', 'waste_transfer_notes', 'weighbridge_readings',
    'weight_logs', 'yard_staff',
    -- previously missed in the live pass:
    'external_map_points', 'route_plans', 'route_performance_logs', 'skips'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID '
        || 'REFERENCES public.tenants(id) '
        || 'DEFAULT ''56ec5b3f-6d42-4672-a98c-d60d9c22f284''::uuid',
        t
      );
      EXECUTE format(
        'UPDATE public.%I SET tenant_id = ''56ec5b3f-6d42-4672-a98c-d60d9c22f284''::uuid WHERE tenant_id IS NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_tenant ON public.%I (tenant_id)',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- 3. Per-tenant config --------------------------------------------
-- 001_schema.sql made `key` the primary key; two tenants would
-- overwrite each other's settings. PK becomes (key, tenant_id).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.config'::regclass
      AND i.indisprimary
      AND i.indnkeyatts = 1
  ) THEN
    ALTER TABLE public.config DROP CONSTRAINT config_pkey;
    ALTER TABLE public.config ALTER COLUMN tenant_id SET NOT NULL;
    ALTER TABLE public.config ADD CONSTRAINT config_pkey PRIMARY KEY (key, tenant_id);
  END IF;
END $$;

-- 4. Tenant-aware views -------------------------------------------
-- Each view now exposes tenant_id so the app can filter per tenant.
DROP VIEW IF EXISTS public.v_collections_due;
DROP VIEW IF EXISTS public.v_driver_hours_today;
DROP VIEW IF EXISTS public.v_inventory_summary;
DROP VIEW IF EXISTS public.v_unpaid_invoices;
DROP VIEW IF EXISTS public.v_dashboard_stats;
DROP VIEW IF EXISTS public.v_tips_today;

CREATE VIEW public.v_collections_due AS
SELECT
  i.tenant_id,
  i.customer_name,
  i.delivery_address AS address,
  i.skip_id,
  i.skip_size,
  i.delivery_date,
  CASE WHEN i.delivery_date IS NOT NULL THEN
    EXTRACT(DAY FROM NOW() - i.delivery_date::timestamptz)
  ELSE 0 END AS days_on_hire
FROM public.inventory i
WHERE i.status IN ('Delivered', 'In Use');

CREATE VIEW public.v_driver_hours_today AS
SELECT
  d.tenant_id,
  d.name AS driver_name,
  COALESCE(dh.hours_worked, 0) AS hours_today,
  dh.clock_in AS last_clock_in,
  CASE WHEN dh.clock_out IS NULL AND dh.clock_in IS NOT NULL THEN TRUE ELSE FALSE END AS currently_clocked_in,
  dh.vehicle_reg AS current_lorry
FROM public.drivers d
LEFT JOIN public.driver_hours dh ON dh.driver_id = d.id::text AND dh.date = CURRENT_DATE;

CREATE VIEW public.v_inventory_summary AS
SELECT
  tenant_id,
  skip_size,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'Available') AS available,
  COUNT(*) FILTER (WHERE status IN ('Delivered', 'In Use')) AS out_on_hire,
  COUNT(*) FILTER (WHERE status = 'Damaged') AS damaged
FROM public.inventory
GROUP BY tenant_id, skip_size;

CREATE VIEW public.v_unpaid_invoices AS
SELECT
  o.tenant_id,
  o.id,
  o."date" AS date,
  o.customer_name,
  o.address,
  o.skip_id_used AS skip_id,
  0 AS amount,
  'Orders' AS source
FROM public.orders o
WHERE o.status = 'Completed' AND o.paid = FALSE AND o.payment_method = 'Invoice'
UNION ALL
SELECT
  c.tenant_id,
  c.id,
  c.logged_at::date AS date,
  c.customer_name,
  c.address,
  c.skip_size AS skip_id,
  c.cost_gross AS amount,
  'CashLog' AS source
FROM public.cash_log c
WHERE c.amount_paid < c.cost_gross AND c.payment_method = 'Invoice';

CREATE VIEW public.v_dashboard_stats AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE status = 'Completed' AND date = CURRENT_DATE) AS completed_today,
  COUNT(*) FILTER (WHERE status = 'Completed' AND date >= date_trunc('week', CURRENT_DATE::timestamptz)) AS completed_week,
  COUNT(*) FILTER (WHERE status IN ('Booked', 'Assigned') AND date > CURRENT_DATE) AS future_bookings
FROM public.orders
GROUP BY tenant_id;

CREATE VIEW public.v_tips_today AS
SELECT
  tenant_id,
  COUNT(*) AS tips_today
FROM public.cash_log
WHERE logged_at::date = CURRENT_DATE
GROUP BY tenant_id;
