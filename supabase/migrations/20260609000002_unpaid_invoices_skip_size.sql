-- v_unpaid_invoices: expose skip_size as its own column. The Orders branch
-- previously only exposed skip_id_used (a skip number like "S-14"), so the
-- dashboard could neither show the size nor price the hire from config.
DROP VIEW IF EXISTS public.v_unpaid_invoices;

CREATE VIEW public.v_unpaid_invoices AS
SELECT
  o.tenant_id,
  o.id,
  o."date" AS date,
  o.customer_name,
  o.address,
  o.skip_id_used AS skip_id,
  o.skip_size,
  0 AS amount,
  'Orders' AS source
FROM public.orders o
WHERE o.status = 'Completed' AND o.paid = FALSE AND o.payment_method = 'Invoice'
UNION ALL
SELECT
  c.tenant_id,
  c.id,
  c.logged_at::date AS date,
  c.customer_name,
  c.address,
  c.ticket_number AS skip_id,
  c.skip_size,
  c.cost_gross AS amount,
  'CashLog' AS source
FROM public.cash_log c
WHERE c.amount_paid < c.cost_gross AND c.payment_method = 'Invoice';
