-- Migration: Backfill customer_id on orders and cash_log
-- then enforce NOT NULL on the FK

-- Step 1: Add customer_id column to cash_log if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_log' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE cash_log ADD COLUMN customer_id UUID REFERENCES customers(id);
  END IF;
END $$;

-- Step 2: Add customer_id column to weight_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weight_logs' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE weight_logs ADD COLUMN customer_id UUID REFERENCES customers(id);
  END IF;
END $$;

-- Step 3: Backfill orders.customer_id from customers table by name matching
UPDATE orders
SET customer_id = customers.id
FROM customers
WHERE orders.customer_id IS NULL
  AND LOWER(TRIM(orders.customer_name)) = LOWER(TRIM(customers.name));

-- Step 4: Backfill cash_log.customer_id from customers table by name matching
UPDATE cash_log
SET customer_id = customers.id
FROM customers
WHERE cash_log.customer_id IS NULL
  AND LOWER(TRIM(cash_log.customer_name)) = LOWER(TRIM(customers.name));

-- Step 5: Backfill weight_logs.customer_id from customers table by name matching
UPDATE weight_logs
SET customer_id = customers.id
FROM customers
WHERE weight_logs.customer_id IS NULL
  AND LOWER(TRIM(weight_logs.customer_name)) = LOWER(TRIM(customers.name));

-- Report how many rows still have NULL customer_id (for manual review)
SELECT 'orders with NULL customer_id' as table_name, COUNT(*) as count FROM orders WHERE customer_id IS NULL
UNION ALL
SELECT 'cash_log with NULL customer_id', COUNT(*) FROM cash_log WHERE customer_id IS NULL
UNION ALL
SELECT 'weight_logs with NULL customer_id', COUNT(*) FROM weight_logs WHERE customer_id IS NULL;

-- NOTE: Enforcing NOT NULL will be done in a follow-up migration
-- after manual review of unmatched rows. Do NOT enforce NOT NULL yet.
-- ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;
-- ALTER TABLE cash_log ALTER COLUMN customer_id SET NOT NULL;
-- ALTER TABLE weight_logs ALTER COLUMN customer_id SET NOT NULL;
