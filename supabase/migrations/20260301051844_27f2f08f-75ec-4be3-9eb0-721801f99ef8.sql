
-- 1. Add provider_type and provider_name to scholarships
ALTER TABLE public.scholarships
  ADD COLUMN IF NOT EXISTS provider_type TEXT CHECK (provider_type IN ('University', 'Government', 'External Agency')),
  ADD COLUMN IF NOT EXISTS provider_name TEXT DEFAULT 'Unknown';

-- 2. Add graduated_year to education_history
ALTER TABLE public.education_history
  ADD COLUMN IF NOT EXISTS graduated_year INTEGER;
