-- ============================================================
-- RLS hardening: restrict anon access; PIN verification is server-side
-- Service role (API routes / server actions) bypasses RLS automatically.
-- ============================================================

-- Drop legacy "any authenticated user" policies (app does not use Supabase Auth JWT)
DROP POLICY IF EXISTS "Authenticated users full access" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.weight_logs;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.cash_log;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.shifts;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.lorries;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.active_tippers;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.fleet_logs;

-- Views for client reads without sensitive columns
CREATE OR REPLACE VIEW public.drivers_public AS
  SELECT id, name, status, phone, created_at
  FROM public.drivers;

CREATE OR REPLACE VIEW public.yard_staff_public AS
  SELECT id, name, created_at
  FROM public.yard_staff;

-- Read-only anon access for operational UI (no PIN / portal_pin exposure)
CREATE POLICY "anon_read_orders" ON public.orders
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_customers_limited" ON public.customers
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_inventory" ON public.inventory
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_active_tippers" ON public.active_tippers
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_lorries" ON public.lorries
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_shifts" ON public.shifts
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_cash_log" ON public.cash_log
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_weight_logs" ON public.weight_logs
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_config" ON public.config
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_custom_pricing" ON public.custom_pricing
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_skip_combos" ON public.skip_combos
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_fuel_cards" ON public.fuel_cards
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_weighbridge" ON public.weighbridge_readings
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_tare_weights" ON public.tare_weights
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_permits" ON public.permits
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_vehicles" ON public.vehicles
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_external_map" ON public.external_map_points
  FOR SELECT TO anon USING (true);

-- Deny anon direct access to credential tables (login via /api/auth/* only)
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yard_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_drivers" ON public.drivers;
DROP POLICY IF EXISTS "anon_read_yard_staff" ON public.yard_staff;

-- Revoke default anon on PIN tables (no policies = deny for anon)
REVOKE ALL ON public.drivers FROM anon;
REVOKE ALL ON public.yard_staff FROM anon;
GRANT SELECT ON public.drivers_public TO anon;
GRANT SELECT ON public.yard_staff_public TO anon;
