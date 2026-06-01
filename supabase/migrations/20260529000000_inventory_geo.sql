-- Add GPS coordinates to inventory (skips) so they can be plotted on the office map.
-- Root cause fix: map-tab's "Active Skips" layer filtered on inventory.latitude/longitude,
-- but those columns never existed — so no skip ever appeared. Contact details already
-- exist as inventory.customer_phone.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

-- Speeds up "show me every skip currently on the map" queries.
CREATE INDEX IF NOT EXISTS idx_inventory_location
  ON public.inventory (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
