-- Review script for customer_id backfill
-- Run this after applying migration 20260518000002 to check results

-- Count rows that were matched
SELECT 
  'orders - matched' as category,
  COUNT(*) as count
FROM orders 
WHERE customer_id IS NOT NULL
UNION ALL
SELECT 
  'orders - unmatched (NULL customer_id)',
  COUNT(*)
FROM orders 
WHERE customer_id IS NULL
UNION ALL
SELECT 
  'cash_log - matched',
  COUNT(*)
FROM cash_log 
WHERE customer_id IS NOT NULL
UNION ALL
SELECT 
  'cash_log - unmatched (NULL customer_id)',
  COUNT(*)
FROM cash_log 
WHERE customer_id IS NULL
UNION ALL
SELECT 
  'weight_logs - matched',
  COUNT(*)
FROM weight_logs 
WHERE customer_id IS NOT NULL
UNION ALL
SELECT 
  'weight_logs - unmatched (NULL customer_id)',
  COUNT(*)
FROM weight_logs 
WHERE customer_id IS NULL;

-- Show unmatched rows for manual review
SELECT id, customer_name, date, status 
FROM orders 
WHERE customer_id IS NULL
ORDER BY date DESC
LIMIT 50;

-- Show customer name variations that might need merging
SELECT 
  LOWER(TRIM(name)) as normalized_name,
  COUNT(*) as customer_count,
  STRING_AGG(name, ' | ') as original_names
FROM customers
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;
