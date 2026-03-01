
-- Create providers table
CREATE TABLE public.providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  provider_type text,
  country text,
  website text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Agents (service_role) can manage providers
CREATE POLICY "Service role full access on providers"
  ON public.providers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anyone can read providers
CREATE POLICY "Public read access on providers"
  ON public.providers FOR SELECT
  USING (true);

-- Add FK from scholarships.provider_id to providers
ALTER TABLE public.scholarships
  DROP CONSTRAINT IF EXISTS scholarships_provider_id_fkey,
  ADD CONSTRAINT scholarships_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.providers(id);
