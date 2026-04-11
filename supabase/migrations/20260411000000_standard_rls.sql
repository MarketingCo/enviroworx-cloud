-- ============================================================
-- ENVIROWORX CLOUD - STANDARD RLS & MISSING TABLES
-- Migration 20260411000000: Enable RLS on all tables
-- ============================================================

-- 1. Ensure missing tables exist
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamp with time zone DEFAULT now(),
  type text,
  message text,
  status text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reg text NOT NULL UNIQUE,
  name text,
  type text,
  notes text,
  active boolean DEFAULT true,
  tare_weight numeric(10, 2),
  mot_due date,
  tax_due date,
  insurance_expiry date,
  last_service_date date,
  last_service_mileage integer,
  last_6weekly_date date,
  operator_licence text,
  verizon_vehicle_number text,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  speed numeric(5, 2),
  heading numeric(5, 2),
  last_updated timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS on all public tables and create standard policy
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        
        -- Drop existing policy if it exists to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON public.%I;', t);
        
        -- Create standard policy: Authenticated users can do everything
        EXECUTE format('CREATE POLICY "Authenticated users full access" ON public.%I FOR ALL USING (auth.role() = ''authenticated'');', t);
        
        RAISE NOTICE 'Enabled RLS and standard policy for table: %', t;
    END LOOP;
END $$;

-- 3. Explicitly disable access for anon role (default is no access if RLS enabled and no policy exists, but being explicit is better)
-- This is handled by not creating any policies for 'anon' role.
