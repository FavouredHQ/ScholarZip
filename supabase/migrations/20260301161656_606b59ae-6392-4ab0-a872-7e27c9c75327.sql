
ALTER TABLE public.source_hubs
  ADD COLUMN IF NOT EXISTS crawl_mode text NOT NULL DEFAULT 'crawl',
  ADD COLUMN IF NOT EXISTS crawl_depth_override integer,
  ADD COLUMN IF NOT EXISTS crawl_pages_override integer;
