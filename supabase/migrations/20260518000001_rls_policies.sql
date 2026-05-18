-- Migration: Row-Level Security Policies — 2026-05-18
-- Replaces overly-permissive "Authenticated users full access" policies
-- with role- and user-scoped policies for each table.
--
-- Run AFTER: 20260518000000_auth_system.sql (role columns, auth_user_id FKs)

-- ============================================================================
-- 1. Enable RLS on all tables
-- ============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE lorries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_tippers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tare_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Drop old permissive policies
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users full access" ON customers;
DROP POLICY IF EXISTS "Authenticated users full access" ON orders;
DROP POLICY IF EXISTS "Authenticated users full access" ON inventory;
DROP POLICY IF EXISTS "Authenticated users full access" ON weight_logs;
DROP POLICY IF EXISTS "Authenticated users full access" ON cash_log;
DROP POLICY IF EXISTS "Authenticated users full access" ON shifts;
DROP POLICY IF EXISTS "Authenticated users full access" ON drivers;
DROP POLICY IF EXISTS "Authenticated users full access" ON lorries;
DROP POLICY IF EXISTS "Authenticated users full access" ON active_tippers;
DROP POLICY IF EXISTS "Authenticated users full access" ON fleet_logs;

-- ============================================================================
-- 3. Granular RLS policies
-- ============================================================================

-- Customers: customers can only see / update their own row
CREATE POLICY "Customers see own data" ON customers
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Customers update own data" ON customers
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Customers: office staff full access
CREATE POLICY "Customers office all" ON customers
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

-- Orders: customers see only their orders, office staff see all
CREATE POLICY "Orders customer view" ON orders
  FOR SELECT USING (
    auth.uid() IN (SELECT auth_user_id FROM customers WHERE customers.id = orders.customer_id)
    OR auth.jwt() ->> 'role' IN ('office', 'yard')
  );

CREATE POLICY "Orders office all" ON orders
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard', 'driver'));

-- Cash log: customers can view their own entries, office staff full access
CREATE POLICY "Cash log customer view" ON cash_log
  FOR SELECT USING (
    auth.uid() IN (SELECT auth_user_id FROM customers WHERE LOWER(TRIM(customers.name)) = LOWER(TRIM(cash_log.customer_name)))
    OR auth.jwt() ->> 'role' IN ('office', 'yard')
  );

CREATE POLICY "Cash log office all" ON cash_log
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

-- Inventory: office staff full access, drivers can read
CREATE POLICY "Inventory office all" ON inventory
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Inventory driver read" ON inventory
  FOR SELECT USING (auth.jwt() ->> 'role' = 'driver');

-- Drivers: readable by office staff and the driver themselves
CREATE POLICY "Drivers office view" ON drivers
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Drivers self view" ON drivers
  FOR SELECT USING (auth.uid() = auth_user_id);

-- Driver PIN hash never selectable by anon
CREATE POLICY "Driver PIN protected" ON drivers
  FOR SELECT USING (auth.role() != 'anon');

-- Yard staff: office readable/writable
CREATE POLICY "Yard staff office" ON yard_staff
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

-- Lorries: office full access
CREATE POLICY "Lorries office all" ON lorries
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Lorries driver read" ON lorries
  FOR SELECT USING (auth.jwt() ->> 'role' = 'driver');

-- All other tables: office staff full access
CREATE POLICY "Office full access weight_logs" ON weight_logs
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access shifts" ON shifts
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access permits" ON permits
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access fleet" ON fleet_logs
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access tippers" ON active_tippers
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access tare_weights" ON tare_weights
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access custom_pricing" ON custom_pricing
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access vehicle_maintenance" ON vehicle_maintenance
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access vehicle_checks" ON vehicle_checks
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access incidents" ON incidents
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));

CREATE POLICY "Office full access hr_logs" ON hr_logs
  FOR ALL USING (auth.jwt() ->> 'role' IN ('office', 'yard'));
