
-- 1. Add provider_subtype column to source_hubs and url_queue
ALTER TABLE public.source_hubs ADD COLUMN provider_subtype text;
ALTER TABLE public.url_queue ADD COLUMN provider_subtype text;

-- 2. Seed missing provider_subtypes for Government and University
INSERT INTO public.provider_subtypes (code, label, parent_type) VALUES
  ('National', 'National', 'Government'),
  ('State / Province', 'State / Province', 'Government'),
  ('Local / Municipal', 'Local / Municipal', 'Government'),
  ('Multilateral', 'Multilateral', 'Government'),
  ('Public', 'Public', 'University'),
  ('Private', 'Private', 'University')
ON CONFLICT (code) DO NOTHING;

-- 3. Add foreign key references
ALTER TABLE public.source_hubs
  ADD CONSTRAINT source_hubs_provider_subtype_fkey
  FOREIGN KEY (provider_subtype) REFERENCES public.provider_subtypes(code);

ALTER TABLE public.url_queue
  ADD CONSTRAINT url_queue_provider_subtype_fkey
  FOREIGN KEY (provider_subtype) REFERENCES public.provider_subtypes(code);

-- 4. Create validation trigger for source_hubs
CREATE OR REPLACE FUNCTION public.validate_source_hub_subtype()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.provider_type = 'External Agency' AND NEW.provider_subtype IS NULL THEN
    RAISE EXCEPTION 'provider_subtype is required when provider_type is External Agency';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_source_hub_subtype
  BEFORE INSERT OR UPDATE ON public.source_hubs
  FOR EACH ROW EXECUTE FUNCTION public.validate_source_hub_subtype();

-- 5. Create validation trigger for url_queue
CREATE OR REPLACE FUNCTION public.validate_url_queue_subtype()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.provider_type = 'External Agency' AND NEW.provider_subtype IS NULL THEN
    RAISE EXCEPTION 'provider_subtype is required when provider_type is External Agency';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_url_queue_subtype
  BEFORE INSERT OR UPDATE ON public.url_queue
  FOR EACH ROW EXECUTE FUNCTION public.validate_url_queue_subtype();

-- 6. Ensure scholarships validation trigger is also attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_scholarship_subtype'
  ) THEN
    CREATE TRIGGER trg_validate_scholarship_subtype
      BEFORE INSERT OR UPDATE ON public.scholarships
      FOR EACH ROW EXECUTE FUNCTION public.validate_scholarship_subtype();
  END IF;
END $$;
