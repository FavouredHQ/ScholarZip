
-- Add missing columns to source_hubs
ALTER TABLE public.source_hubs
  ADD COLUMN IF NOT EXISTS next_crawl_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;

-- Agent settings table for runtime configuration
CREATE TABLE IF NOT EXISTS public.agent_settings (
  agent_name text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_settings"
  ON public.agent_settings FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admin full access on agent_settings"
  ON public.agent_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
