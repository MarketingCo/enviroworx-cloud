-- The supabase_realtime publication was empty, so no postgres_changes
-- subscription in the app (live scale weight, map sync, tipping queue,
-- inventory refresh) ever received an event. Add every table the app
-- subscribes to. Idempotent.
do $$
declare t text;
begin
  foreach t in array array['weighbridge_readings','active_tippers','cash_log','inventory','orders','shifts','vehicles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
