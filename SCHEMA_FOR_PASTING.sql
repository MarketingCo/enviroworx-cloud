gen_random_uuid()-- ============================================================
-- ENVIROWORX CLOUD - SUPABASE DATABASE SCHEMA
-- Migration 001: Core Tables, Indexes, RLS Policies
-- ============================================================
-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES (enforces data integrity, replaces free-text)
-- ============================================================
CREATE TYPE order_status AS ENUM (
  'Booked', 'Assigned', 'Out for Delivery', 'Completed', 'Cancelled', 'Aborted'
);
CREATE TYPE job_type AS ENUM (
  'Delivery', 'Exchange', 'Collection', 'Wait & Load', 'Cage Load'
);
CREATE TYPE payment_method AS ENUM (
  'Invoice', 'Cash', 'Card'
);
CREATE TYPE skip_status AS ENUM (
  'Available', 'Delivered', 'In Use', 'Damaged', 'Decommissioned'
);
CREATE TYPE lorry_status AS ENUM (
  'Available', 'In Use', 'Maintenance', 'Off Road'
);
CREATE TYPE driver_status AS ENUM (
  'Available', 'Off', 'Office', 'On Route'
);
CREATE TYPE waste_type AS ENUM (
  'Mix Con', 'Mix Mun', 'Wood', 'Inert', 'Soil', 'Cardboard', 'Metal', 'TBC'
);
CREATE TYPE rha_status AS ENUM ('Pass', 'Fail');
CREATE TYPE fleet_issue_type AS ENUM (
  'RHA Pass', 'RHA Fail', 'Minor Defect', 'Major Defect', 'Incident'
);
CREATE TYPE direction_type AS ENUM ('On-site', 'Off-site');

-- ============================================================
-- CORE BUSINESS TABLES
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  billing_address TEXT,
  email TEXT,
  invoice_type TEXT DEFAULT 'Invoice',
  full_name TEXT,
  shipping_address TEXT,
  account_balance NUMERIC(10,2) DEFAULT 0,
  comments TEXT,
  portal_pin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customers_name ON customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_phone ON customers (phone);
CREATE UNIQUE INDEX idx_customers_name_unique ON customers (LOWER(TRIM(name)));

CREATE TABLE custom_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  skip_size TEXT,
  waste_type TEXT,
  net_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_custom_pricing_customer ON custom_pricing (customer_name);
CREATE INDEX idx_custom_pricing_name_lower ON custom_pricing USING gin (LOWER(customer_name) gin_trgm_ops);

CREATE TABLE lorries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lorry_type TEXT DEFAULT 'Skip',
  status lorry_status DEFAULT 'Available',
  registration TEXT NOT NULL UNIQUE,
  tax_due DATE,
  maintenance_due DATE,
  mot_due DATE,
  brake_check DATE,
  tacho_calibration DATE,
  loler_test DATE,
  vehicle_condition TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lorries_reg ON lorries (UPPER(REPLACE(registration, ' ', '')));

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  status driver_status DEFAULT 'Available',
  pin TEXT,
  pay_rate NUMERIC(6,2),
  auth_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE yard_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  pay_rate NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skip_id TEXT NOT NULL UNIQUE,
  lorry_type TEXT DEFAULT 'Skip',
  skip_size TEXT NOT NULL,
  priority_score INTEGER,
  customer_request TEXT DEFAULT 'Standard',
  status skip_status DEFAULT 'Available',
  delivery_address TEXT,
  date_booked TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  scheduled_return_date TIMESTAMPTZ,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  payment_method payment_method,
  payment_status TEXT,
  comments TEXT,
  ticket_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_status ON inventory (status);
CREATE INDEX idx_inventory_skip_id ON inventory (UPPER(REPLACE(skip_id, ' ', '')));
CREATE INDEX idx_inventory_customer ON inventory (customer_id);
CREATE INDEX idx_inventory_size_status ON inventory (skip_size, status);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status order_status DEFAULT 'Booked',
  skip_size TEXT NOT NULL,
  job_type job_type NOT NULL,
  address TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  phone TEXT,
  payment_method payment_method DEFAULT 'Invoice',
  comments TEXT,
  delivery_comments TEXT,
  in_diary BOOLEAN DEFAULT FALSE,
  on_map BOOLEAN DEFAULT FALSE,
  skip_id_used TEXT,
  paid BOOLEAN DEFAULT FALSE,
  photo_proof TEXT,
  driver_id UUID REFERENCES drivers(id),
  driver_name TEXT,
  depart_time TIMESTAMPTZ,
  arrive_time TIMESTAMPTZ,
  voice_note_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_date ON orders (date);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_date_status ON orders (date, status);
CREATE INDEX idx_orders_driver ON orders (driver_id);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_customer_name ON orders USING gin (customer_name gin_trgm_ops);

CREATE TABLE weight_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  ticket_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  lorry_reg TEXT,
  skip_size TEXT,
  skip_id TEXT,
  address TEXT,
  waste_type waste_type,
  gross_weight NUMERIC(10,2) DEFAULT 0,
  tare_weight NUMERIC(10,2) DEFAULT 0,
  net_weight NUMERIC(10,2) DEFAULT 0,
  mix_con NUMERIC(10,2) DEFAULT 0,
  mix_mun NUMERIC(10,2) DEFAULT 0,
  wood NUMERIC(10,2) DEFAULT 0,
  inert NUMERIC(10,2) DEFAULT 0,
  soil NUMERIC(10,2) DEFAULT 0,
  cardboard NUMERIC(10,2) DEFAULT 0,
  metal NUMERIC(10,2) DEFAULT 0,
  direction direction_type DEFAULT 'On-site',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_weight_logs_date ON weight_logs (logged_at);
CREATE INDEX idx_weight_logs_ticket ON weight_logs (ticket_number);
CREATE INDEX idx_weight_logs_customer ON weight_logs USING gin (customer_name gin_trgm_ops);

CREATE TABLE weighbridge_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  weight_kg NUMERIC(10,2) NOT NULL,
  description TEXT,
  reg_number TEXT
);
CREATE INDEX idx_weighbridge_timestamp ON weighbridge_readings (timestamp DESC);
CREATE INDEX idx_weighbridge_reg ON weighbridge_readings (UPPER(REPLACE(reg_number, ' ', '')));

CREATE TABLE cash_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  ticket_number TEXT,
  customer_name TEXT NOT NULL,
  skip_size TEXT,
  address TEXT,
  waste_type TEXT,
  gross_weight NUMERIC(10,2) DEFAULT 0,
  net_weight NUMERIC(10,2) DEFAULT 0,
  cost_net NUMERIC(10,2) DEFAULT 0,
  cost_gross NUMERIC(10,2) DEFAULT 0,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  payment_method payment_method DEFAULT 'Invoice',
  tyl_ref TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cash_log_date ON cash_log (logged_at);
CREATE INDEX idx_cash_log_customer ON cash_log USING gin (customer_name gin_trgm_ops);
CREATE INDEX idx_cash_log_unpaid ON cash_log (payment_method, amount_paid, cost_gross)
  WHERE payment_method = 'Invoice' AND amount_paid < cost_gross;

CREATE TABLE active_tippers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  reg TEXT NOT NULL,
  customer_name TEXT,
  waste_type TEXT,
  gross_weight NUMERIC(10,2) DEFAULT 0,
  address TEXT,
  skip_size TEXT,
  skip_id TEXT
);
CREATE INDEX idx_tippers_timestamp ON active_tippers (timestamp DESC);

CREATE TABLE tare_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lorry_registration TEXT NOT NULL,
  skip_size TEXT NOT NULL,
  tare_weight NUMERIC(10,2) NOT NULL,
  UNIQUE(lorry_registration, skip_size)
);

CREATE TABLE skip_combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination TEXT NOT NULL UNIQUE
);

CREATE TABLE fuel_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin TEXT NOT NULL,
  reg TEXT NOT NULL
);

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee TEXT NOT NULL,
  date DATE NOT NULL,
  role_or_lorry TEXT,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  total_mins NUMERIC(8,2) DEFAULT 0,
  break_mins NUMERIC(8,2) DEFAULT 45,
  payable_hours NUMERIC(8,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shifts_employee_date ON shifts (employee, date);

CREATE TABLE hr_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  employee TEXT NOT NULL,
  category TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE fleet_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lorry_reg TEXT NOT NULL,
  issue_type fleet_issue_type NOT NULL,
  description TEXT,
  reported_by TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fleet_logs_date ON fleet_logs (timestamp DESC);

CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lorry_reg TEXT NOT NULL,
  reported_by TEXT,
  issue_description TEXT,
  status TEXT DEFAULT 'Open',
  repair_cost NUMERIC(10,2)
);

CREATE TABLE archive_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_id UUID,
  data JSONB NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONFIG TABLE (replaces hardcoded CONFIG object)
-- ============================================================
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config (key, value) VALUES
  ('vat_rate', '0.20'),
  ('credit_limit', '500'),
  ('max_drive_hours', '9'),
  ('warn_drive_hours', '8.5'),
  ('demurrage_days', '28'),
  ('demurrage_net_fee', '30.00'),
  ('permit_admin_fee', '40'),
  ('permit_weekly_fee', '45'),
  ('office_phone', '"01310000000"'),
  ('prices_waste', '{"Mix Con": 165, "Mix Mun": 200, "Wood": 80, "Inert": 40, "Soil": 40, "Cardboard": 0, "Metal": 0}'),
  ('prices_skip', '{"4": 180, "6": 220, "8": 250, "10": 290, "12": 330, "14": 350, "E14": 350, "16": 380, "E16": 380, "20": 450, "25": 520, "40": 650, "Cage": 180}');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_lorries_updated BEFORE UPDATE ON lorries
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE SEQUENCE weight_ticket_seq START WITH 19000;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number = LPAD(nextval('weight_ticket_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weight_log_ticket BEFORE INSERT ON weight_logs
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

CREATE OR REPLACE FUNCTION calc_net_weight()
RETURNS TRIGGER AS $$
BEGIN
  NEW.net_weight = ABS(COALESCE(NEW.gross_weight, 0) - COALESCE(NEW.tare_weight, 0));
  IF NEW.waste_type = 'Mix Con' THEN NEW.mix_con = NEW.net_weight; END IF;
  IF NEW.waste_type = 'Mix Mun' THEN NEW.mix_mun = NEW.net_weight; END IF;
  IF NEW.waste_type = 'Wood' THEN NEW.wood = NEW.net_weight; END IF;
  IF NEW.waste_type = 'Inert' THEN NEW.inert = NEW.net_weight; END IF;
  IF NEW.waste_type = 'Soil' THEN NEW.soil = NEW.net_weight; END IF;
  IF NEW.waste_type = 'Cardboard' THEN NEW.cardboard = NEW.net_weight; END IF;
  IF NEW.waste_type = 'Metal' THEN NEW.metal = NEW.net_weight; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_net BEFORE INSERT OR UPDATE ON weight_logs
  FOR EACH ROW EXECUTE FUNCTION calc_net_weight();

-- ============================================================
-- VIEWS (replaces the massive getBusinessData() function)
-- ============================================================

CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'Completed' AND date = CURRENT_DATE) AS completed_today,
  COUNT(*) FILTER (WHERE status = 'Completed' AND date >= date_trunc('week', CURRENT_DATE)) AS completed_week,
  COUNT(*) FILTER (WHERE status IN ('Booked', 'Assigned') AND date > CURRENT_DATE) AS future_bookings
FROM orders;

CREATE OR REPLACE VIEW v_tips_today AS
SELECT COUNT(*) AS tips_today
FROM cash_log
WHERE logged_at::DATE = CURRENT_DATE;

CREATE OR REPLACE VIEW v_inventory_summary AS
SELECT
  skip_size,
  COUNT(*) FILTER (WHERE status = 'Available') AS available,
  COUNT(*) FILTER (WHERE status IN ('Delivered', 'In Use')) AS out_on_hire,
  COUNT(*) FILTER (WHERE status = 'Damaged') AS damaged
FROM inventory
GROUP BY skip_size
ORDER BY
  CASE
    WHEN skip_size ~ '^\d+$' THEN skip_size::INT
    ELSE 999
  END;

CREATE OR REPLACE VIEW v_collections_due AS
SELECT
  i.skip_id,
  i.skip_size,
  i.delivery_address,
  i.customer_name,
  i.delivery_date,
  EXTRACT(DAY FROM NOW() - i.delivery_date)::INT AS days_on_hire
FROM inventory i
WHERE i.status IN ('Delivered', 'In Use')
  AND i.delivery_date IS NOT NULL
ORDER BY days_on_hire DESC;

CREATE OR REPLACE VIEW v_unpaid_invoices AS
(
  SELECT
    'Orders' AS source,
    o.id,
    o.date::TEXT AS date,
    o.customer_name,
    o.address,
    o.skip_id_used AS skip_id,
    o.skip_size,
    NULL::NUMERIC AS gross_cost,
    o.photo_proof AS doc_link
  FROM orders o
  WHERE o.status = 'Completed'
    AND o.paid = FALSE
    AND o.payment_method = 'Invoice'
    AND o.date >= CURRENT_DATE - INTERVAL '3 months'
)
UNION ALL
(
  SELECT
    'CashLog' AS source,
    cl.id,
    cl.logged_at::DATE::TEXT AS date,
    cl.customer_name,
    COALESCE(cl.address, 'Yard Tip') AS address,
    cl.ticket_number AS skip_id,
    'Tip: ' || COALESCE(cl.waste_type, '') AS skip_size,
    cl.cost_gross AS gross_cost,
    NULL AS doc_link
  FROM cash_log cl
  WHERE cl.payment_method = 'Invoice'
    AND (cl.amount_paid IS NULL OR cl.amount_paid < cl.cost_gross)
    AND cl.logged_at >= CURRENT_DATE - INTERVAL '3 months'
)
ORDER BY date DESC;

CREATE OR REPLACE VIEW v_driver_hours_today AS
SELECT
  s.employee AS driver_name,
  SUM(
    CASE
      WHEN s.clock_out IS NOT NULL THEN s.total_mins / 60.0
      ELSE EXTRACT(EPOCH FROM (NOW() - s.clock_in)) / 3600.0
    END
  ) AS hours_today,
  BOOL_OR(s.clock_out IS NULL) AS currently_clocked_in,
  MAX(s.clock_in) FILTER (WHERE s.clock_out IS NULL) AS last_clock_in,
  MAX(s.role_or_lorry) FILTER (WHERE s.clock_out IS NULL) AS current_lorry
FROM shifts s
WHERE s.date = CURRENT_DATE
GROUP BY s.employee;

CREATE OR REPLACE FUNCTION get_dispatch_jobs(target_date DATE)
RETURNS TABLE (
  id UUID,
  date DATE,
  skip_size TEXT,
  job_type job_type,
  address TEXT,
  customer_name TEXT,
  phone TEXT,
  driver_name TEXT,
  driver_id UUID,
  postcode TEXT,
  status order_status,
  notes TEXT,
  delivery_comments TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.date,
    o.skip_size,
    o.job_type,
    o.address,
    o.customer_name,
    o.phone,
    o.driver_name,
    o.driver_id,
    UPPER(COALESCE(
      (regexp_match(o.address, '\b([A-Z]{1,2}\d{1,2})\b', 'i'))[1],
      'Unknown'
    )) AS postcode,
    o.status,
    o.comments,
    o.delivery_comments
  FROM orders o
  WHERE o.date = target_date
    AND o.status NOT IN ('Completed', 'Cancelled')
  ORDER BY o.driver_name NULLS FIRST, postcode;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lorries ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_tippers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON customers
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON orders
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON inventory
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON weight_logs
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON cash_log
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON shifts
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON drivers
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON lorries
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON active_tippers
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON fleet_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE active_tippers;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE weighbridge_readings;
