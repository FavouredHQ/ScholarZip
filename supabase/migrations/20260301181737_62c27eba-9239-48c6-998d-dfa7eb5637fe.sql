ALTER TABLE public.source_hubs ADD COLUMN crawl_frequency text NOT NULL DEFAULT 'daily';
COMMENT ON COLUMN public.source_hubs.crawl_frequency IS 'How often to re-crawl: daily, weekly, monthly';