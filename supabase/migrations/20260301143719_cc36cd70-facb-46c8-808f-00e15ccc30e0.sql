
-- 1) Create provider_types lookup table
CREATE TABLE public.provider_types (
  code text PRIMARY KEY,
  label text NOT NULL
);

ALTER TABLE public.provider_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access on provider_types"
  ON public.provider_types FOR SELECT USING (true);

CREATE POLICY "Service role full access on provider_types"
  ON public.provider_types FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed provider_types
INSERT INTO public.provider_types (code, label) VALUES
  ('University', 'University'),
  ('Government', 'Government'),
  ('External Agency', 'External Agency');

-- 2) Create provider_subtypes lookup table
CREATE TABLE public.provider_subtypes (
  code text PRIMARY KEY,
  label text NOT NULL,
  parent_type text NOT NULL REFERENCES public.provider_types(code)
);

ALTER TABLE public.provider_subtypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access on provider_subtypes"
  ON public.provider_subtypes FOR SELECT USING (true);

CREATE POLICY "Service role full access on provider_subtypes"
  ON public.provider_subtypes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed provider_subtypes for External Agency
INSERT INTO public.provider_subtypes (code, label, parent_type) VALUES
  ('Foundation', 'Foundation', 'External Agency'),
  ('Nonprofit / Charity', 'Nonprofit / Charity', 'External Agency'),
  ('Corporate', 'Corporate', 'External Agency'),
  ('Professional Association', 'Professional Association', 'External Agency'),
  ('International Organization', 'International Organization', 'External Agency'),
  ('Community Organization', 'Community Organization', 'External Agency'),
  ('Religious Organization', 'Religious Organization', 'External Agency'),
  ('Private Trust', 'Private Trust', 'External Agency'),
  ('Research Institute / Think Tank', 'Research Institute / Think Tank', 'External Agency'),
  ('Other', 'Other', 'External Agency');

-- 3) Add provider_subtype column to scholarships
ALTER TABLE public.scholarships
  ADD COLUMN provider_subtype text;

-- 4) Backfill existing NULL provider_type to 'University' so we can make it NOT NULL
UPDATE public.scholarships SET provider_type = 'University' WHERE provider_type IS NULL;

-- 5) Make provider_type NOT NULL
ALTER TABLE public.scholarships ALTER COLUMN provider_type SET NOT NULL;
ALTER TABLE public.scholarships ALTER COLUMN provider_type SET DEFAULT 'University';

-- 6) Add FK constraints
ALTER TABLE public.scholarships
  ADD CONSTRAINT scholarships_provider_type_fkey
    FOREIGN KEY (provider_type) REFERENCES public.provider_types(code);

ALTER TABLE public.scholarships
  ADD CONSTRAINT scholarships_provider_subtype_fkey
    FOREIGN KEY (provider_subtype) REFERENCES public.provider_subtypes(code);

-- 7) Validation trigger: External Agency requires provider_subtype
CREATE OR REPLACE FUNCTION public.validate_scholarship_subtype()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.provider_type = 'External Agency' AND NEW.provider_subtype IS NULL THEN
    RAISE EXCEPTION 'provider_subtype is required when provider_type is External Agency';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scholarship_subtype
  BEFORE INSERT OR UPDATE ON public.scholarships
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_scholarship_subtype();

-- 8) Also add FK on source_hubs and url_queue provider_type for consistency
ALTER TABLE public.source_hubs
  ADD CONSTRAINT source_hubs_provider_type_fkey
    FOREIGN KEY (provider_type) REFERENCES public.provider_types(code);

ALTER TABLE public.url_queue
  ADD CONSTRAINT url_queue_provider_type_fkey
    FOREIGN KEY (provider_type) REFERENCES public.provider_types(code);

-- 9) Also add FK on providers table
ALTER TABLE public.providers
  ADD CONSTRAINT providers_provider_type_fkey
    FOREIGN KEY (provider_type) REFERENCES public.provider_types(code);
