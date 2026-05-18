-- ============================================================
-- EMERGENCY SCHEMA FIX - Run this entire file in one go
-- ============================================================

-- 1. Add missing columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS "date" DATE,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS depart_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrive_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skip_id_used TEXT,
  ADD COLUMN IF NOT EXISTS photo_proof TEXT,
  ADD COLUMN IF NOT EXISTS in_diary BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_map BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS delivery_comments TEXT;

-- Copy existing order_date into new date column
UPDATE public.orders SET "date" = order_date WHERE "date" IS NULL AND order_date IS NOT NULL;

-- 2. Add status to drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available';

-- 3. Add GPS columns to vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS speed NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS heading NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

-- 4. Create missing tables
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_reg TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  speed NUMERIC(5, 2),
  heading NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders ("date");
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders USING gin (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON public.activity_log (type);
CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_reg ON public.vehicle_telemetry (vehicle_reg);

-- 6. Drop and recreate views
DROP VIEW IF EXISTS public.v_collections_due;
DROP VIEW IF EXISTS public.v_driver_hours_today;
DROP VIEW IF EXISTS public.v_inventory_summary;
DROP VIEW IF EXISTS public.v_unpaid_invoices;

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

CREATE OR REPLACE VIEW public.v_driver_hours_today AS
SELECT
  d.name AS driver_name,
  COALESCE(dh.hours_worked, 0) AS hours_today,
  dh.clock_in AS last_clock_in,
  CASE WHEN dh.clock_out IS NULL AND dh.clock_in IS NOT NULL THEN TRUE ELSE FALSE END AS currently_clocked_in,
  dh.vehicle_reg AS current_lorry
FROM public.drivers d
LEFT JOIN public.driver_hours dh ON dh.driver_id = d.id::text AND dh.date = CURRENT_DATE;

CREATE OR REPLACE VIEW public.v_inventory_summary AS
SELECT
  skip_size,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'Available') AS available,
  COUNT(*) FILTER (WHERE status IN ('Delivered', 'In Use')) AS out_on_hire,
  COUNT(*) FILTER (WHERE status = 'Damaged') AS damaged
FROM public.inventory
GROUP BY skip_size;

CREATE OR REPLACE VIEW public.v_unpaid_invoices AS
SELECT
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
  c.id,
  c.logged_at::date AS date,
  c.customer_name,
  c.address,
  c.skip_size AS skip_id,
  c.cost_gross AS amount,
  'CashLog' AS source
FROM public.cash_log c
WHERE c.amount_paid < c.cost_gross AND c.payment_method = 'Invoice';
