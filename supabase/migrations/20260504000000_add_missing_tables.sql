-- ============================================================
-- MIGRATION: Add missing tables and views for Enviroworx Cloud
-- Run: npx supabase db push
-- ============================================================

-- VEHICLES (comprehensive fleet table)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reg TEXT NOT NULL UNIQUE,
  name TEXT,
  type TEXT,
  active BOOLEAN DEFAULT TRUE,
  tare_weight NUMERIC,
  mot_due DATE,
  tax_due DATE,
  insurance_expiry DATE,
  operator_licence TEXT,
  last_service_date DATE,
  last_service_mileage INTEGER,
  last_6weekly_date DATE,
  notes TEXT,
  verizon_vehicle_number TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  speed NUMERIC(5, 2),
  heading NUMERIC(5, 2),
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DRIVER HOURS (daily hour tracking)
CREATE TABLE IF NOT EXISTS public.driver_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES public.drivers(id),
  driver_name TEXT,
  date DATE,
  vehicle_id UUID REFERENCES public.vehicles(id),
  vehicle_reg TEXT,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER,
  hours_worked NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT,
  description TEXT,
  driver_name TEXT,
  vehicle_reg TEXT,
  location TEXT,
  photo_url TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERMITS
CREATE TABLE IF NOT EXISTS public.permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skip_id TEXT NOT NULL,
  location TEXT NOT NULL,
  permit_number TEXT,
  date_applied DATE,
  date_issued DATE,
  expiry_date DATE NOT NULL,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_permits_expiry ON public.permits (expiry_date);
CREATE INDEX IF NOT EXISTS idx_permits_status ON public.permits (status);

-- VEHICLE CHECKS (daily walkaround check data)
CREATE TABLE IF NOT EXISTS public.vehicle_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_name TEXT,
  lorry_reg TEXT,
  check_data JSONB,
  odometer INTEGER,
  defects_reported TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VEHICLE MAINTENANCE
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_reg TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  mileage INTEGER,
  cost NUMERIC(10, 2),
  performed_by TEXT,
  certificate_ref TEXT,
  next_due_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WALKAROUND CHECKS
CREATE TABLE IF NOT EXISTS public.walkaround_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES public.drivers(id),
  driver_name TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id),
  vehicle_reg TEXT,
  date DATE,
  checks JSONB,
  has_defects BOOLEAN,
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVITY LOG (system audit trail)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON public.activity_log (type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log (created_at);

-- VEHICLE TELEMETRY (historical GPS data)
CREATE TABLE IF NOT EXISTS public.vehicle_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_reg TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  speed NUMERIC(5, 2),
  heading NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_reg ON public.vehicle_telemetry (vehicle_reg);
CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_created ON public.vehicle_telemetry (created_at);

-- ============================================================
-- VIEWS
-- Drop first to avoid column rename conflicts
-- ============================================================

DROP VIEW IF EXISTS public.v_collections_due;
DROP VIEW IF EXISTS public.v_driver_hours_today;
DROP VIEW IF EXISTS public.v_inventory_summary;
DROP VIEW IF EXISTS public.v_unpaid_invoices;

-- Collections due view
CREATE OR REPLACE VIEW public.v_collections_due AS
SELECT
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

-- Driver hours today view
CREATE OR REPLACE VIEW public.v_driver_hours_today AS
SELECT
  d.name AS driver_name,
  COALESCE(dh.hours_worked, 0) AS hours_today,
  dh.clock_in AS last_clock_in,
  CASE WHEN dh.clock_out IS NULL AND dh.clock_in IS NOT NULL THEN TRUE ELSE FALSE END AS currently_clocked_in,
  dh.vehicle_reg AS current_lorry
FROM public.drivers d
LEFT JOIN public.driver_hours dh ON dh.driver_id = d.id::text AND dh.date = CURRENT_DATE;

-- Inventory summary view
CREATE OR REPLACE VIEW public.v_inventory_summary AS
SELECT
  skip_size,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'Available') AS available,
  COUNT(*) FILTER (WHERE status IN ('Delivered', 'In Use')) AS out_on_hire,
  COUNT(*) FILTER (WHERE status = 'Damaged') AS damaged
FROM public.inventory
GROUP BY skip_size;

-- Unpaid invoices view
CREATE OR REPLACE VIEW public.v_unpaid_invoices AS
SELECT
  o.id,
  o.date,
  o.customer_name,
  o.address,
  o.skip_id_used AS skip_id,
  0 AS amount, -- placeholder; real cost lives in cash_log
  'Orders' AS source
FROM public.orders o
WHERE o.status = 'Completed' AND o.paid = FALSE AND o.payment_method = 'Invoice'
UNION ALL
SELECT
  c.id,
  c.logged_at::date AS date,
  c.customer_name,
  c.address,
  c.skip_id,
  c.cost_gross AS amount,
  'CashLog' AS source
FROM public.cash_log c
WHERE c.amount_paid < c.cost_gross AND c.payment_method = 'Invoice';
