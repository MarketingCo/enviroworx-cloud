-- Default office access for Enviroworx (safe to re-run)
INSERT INTO public.office_staff (email, display_name, role, active)
SELECT v.email, v.display_name, v.role, true
FROM (
  VALUES
    ('accounts@enviroworx.co.uk', 'Enviroworx Office', 'admin'),
    ('info@enviroworx.co.uk', 'Enviroworx Info', 'office')
) AS v(email, display_name, role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_staff s
  WHERE lower(trim(s.email)) = lower(trim(v.email))
);
