
-- Add next_run_at to url_queue for backoff support
ALTER TABLE public.url_queue ADD COLUMN IF NOT EXISTS next_run_at timestamptz;

-- Seed Agent 2 settings
INSERT INTO public.agent_settings (agent_name, enabled, settings)
VALUES (
  'process_url_queue',
  true,
  '{
    "batch_size": 3,
    "max_attempts": 3,
    "lock_minutes": 20,
    "min_text_length": 500,
    "use_classifier": true,
    "classifier_min_confidence": 0.6,
    "extraction_min_confidence": 0.6,
    "default_currency": "USD",
    "backoff_minutes_base": 10,
    "backoff_minutes_max": 1440,
    "firecrawl_format": "markdown",
    "firecrawl_timeout_ms": 60000
  }'::jsonb
)
ON CONFLICT (agent_name) DO NOTHING;
