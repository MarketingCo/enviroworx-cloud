-- ============================================================
-- MIGRATION: EWC Codes
-- Adds ewc_codes lookup table and denormalized columns on
-- weight_logs and cash_log
-- ============================================================

-- 1. EWC codes lookup table
CREATE TABLE IF NOT EXISTS ewc_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  hazardous   BOOLEAN NOT NULL DEFAULT false
);

-- 2. Seed common EWC codes for skip hire / transfer station
INSERT INTO ewc_codes (code, description, hazardous) VALUES
  ('17 09 04', 'Mixed construction and demolition wastes', false),
  ('20 03 01', 'Mixed municipal waste', false),
  ('17 02 01', 'Wood', false),
  ('17 04 05', 'Iron and steel', false),
  ('17 01 07', 'Mixtures of concrete, bricks, tiles and ceramics', false),
  ('20 01 01', 'Paper and cardboard', false),
  ('17 05 04', 'Soil and stones', false),
  ('20 03 07', 'Bulky waste', false),
  ('20 01 39', 'Plastics', false),
  ('20 01 40', 'Metals', false),
  ('17 02 03', 'Plastic', false),
  ('20 01 11', 'Textiles', false),
  ('17 06 04', 'Insulation materials other than 17 06 01 and 17 06 03', false),
  ('20 01 38', 'Wood other than 20 01 37', false),
  ('20 02 01', 'Biodegradable waste (green waste)', false)
ON CONFLICT (code) DO NOTHING;

-- 3. Add EWC columns to weight_logs (nullable — backwards compatible)
ALTER TABLE weight_logs
  ADD COLUMN IF NOT EXISTS ewc_code_id UUID REFERENCES ewc_codes(id),
  ADD COLUMN IF NOT EXISTS ewc_code    TEXT;

-- 4. Add EWC columns to cash_log (nullable — backwards compatible)
ALTER TABLE cash_log
  ADD COLUMN IF NOT EXISTS ewc_code_id UUID REFERENCES ewc_codes(id),
  ADD COLUMN IF NOT EXISTS ewc_code    TEXT;
