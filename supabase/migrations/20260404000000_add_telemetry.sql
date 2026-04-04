-- Add telemetry fields to the vehicles table
ALTER TABLE public.vehicles ADD COLUMN latitude numeric(10, 8);
ALTER TABLE public.vehicles ADD COLUMN longitude numeric(11, 8);
ALTER TABLE public.vehicles ADD COLUMN speed numeric(5, 2);
ALTER TABLE public.vehicles ADD COLUMN heading numeric(5, 2);
ALTER TABLE public.vehicles ADD COLUMN last_updated timestamp with time zone;

-- Also add a separate table for historical telemetry (optional but good for tracking)
CREATE TABLE IF NOT EXISTS public.vehicle_telemetry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_reg text NOT NULL,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  speed numeric(5, 2),
  heading numeric(5, 2),
  recorded_at timestamp with time zone DEFAULT now()
);

-- Note: Ensure you run `npx supabase db push` to apply this migration to your project.
