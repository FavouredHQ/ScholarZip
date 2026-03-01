
ALTER TABLE public.scholarships
  ADD COLUMN content_hash text,
  ADD COLUMN last_verified_at timestamptz;

CREATE UNIQUE INDEX idx_scholarships_source_url ON public.scholarships (source_url) WHERE source_url IS NOT NULL;
