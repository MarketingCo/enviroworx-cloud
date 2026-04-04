-- Table for external KML map points
CREATE TABLE IF NOT EXISTS public.external_map_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  folder text,
  style_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for spatial lookups or folder filtering
CREATE INDEX IF NOT EXISTS idx_external_map_points_folder ON public.external_map_points(folder);
