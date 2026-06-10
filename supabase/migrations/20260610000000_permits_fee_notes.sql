-- Permits management UI (P3.1): the table predates the UI and lacked
-- a fee and free-text notes.
alter table public.permits add column if not exists fee numeric;
alter table public.permits add column if not exists notes text;

-- A permit can be applied for before a skip is on site and before the
-- council confirms dates — only location must be present.
alter table public.permits alter column skip_id drop not null;
alter table public.permits alter column expiry_date drop not null;
