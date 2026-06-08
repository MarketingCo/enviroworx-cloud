-- ============================================================
-- MIGRATION: Waste Transfer Notes
-- Creates the waste_transfer_notes table and WTN sequence
-- ============================================================

-- Sequence for auto-incrementing WTN serial numbers
CREATE SEQUENCE IF NOT EXISTS wtn_seq START 1;

CREATE TABLE IF NOT EXISTS waste_transfer_notes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wtn_number            TEXT NOT NULL UNIQUE DEFAULT (
    'WTN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('wtn_seq')::text, 6, '0')
  ),
  weight_log_id         UUID REFERENCES weight_logs(id),
  order_id              UUID REFERENCES orders(id),
  transfer_date         DATE NOT NULL,
  transferor_name       TEXT NOT NULL,
  transferor_address    TEXT,
  transferor_registration TEXT,
  transferee_name       TEXT NOT NULL DEFAULT 'Enviroworx',
  transferee_address    TEXT,
  transferee_registration TEXT,
  waste_description     TEXT NOT NULL,
  ewc_code              TEXT,
  quantity_kg           NUMERIC(10,2),
  quantity_description  TEXT,
  vehicle_reg           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
