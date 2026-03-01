
-- 1) source_hubs: Discovery Control Layer
CREATE TABLE public.source_hubs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_url text NOT NULL,
  provider_name text,
  provider_type text,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  last_crawled_at timestamptz,
  status text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.source_hubs ENABLE ROW LEVEL SECURITY;

-- Public read for agents authenticated via service role; no anon access needed
CREATE POLICY "Service role full access on source_hubs"
  ON public.source_hubs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2) url_queue: Agent Work Inbox
CREATE TABLE public.url_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  provider_name text,
  provider_type text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  discovered_from uuid REFERENCES public.source_hubs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.url_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on url_queue"
  ON public.url_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Useful indexes
CREATE INDEX idx_url_queue_status ON public.url_queue (status);
CREATE UNIQUE INDEX idx_url_queue_url ON public.url_queue (url);
CREATE INDEX idx_source_hubs_active ON public.source_hubs (is_active) WHERE is_active = true;
