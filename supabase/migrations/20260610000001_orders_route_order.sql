-- Route optimisation (P3.3): optimiser writes the stop sequence here;
-- the driver app orders by it.
alter table public.orders add column if not exists route_order int;
