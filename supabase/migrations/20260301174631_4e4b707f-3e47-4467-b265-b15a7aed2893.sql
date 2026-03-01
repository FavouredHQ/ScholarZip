
-- Create agent_run_logs table
CREATE TABLE public.agent_run_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  run_type TEXT NOT NULL DEFAULT 'scheduled',
  status TEXT NOT NULL DEFAULT 'running',
  summary JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  error TEXT
);

-- Index for efficient queries by agent + time
CREATE INDEX idx_agent_run_logs_agent_started ON public.agent_run_logs (agent_name, started_at DESC);

-- Enable RLS
ALTER TABLE public.agent_run_logs ENABLE ROW LEVEL SECURITY;

-- Admin access
CREATE POLICY "Admin full access on agent_run_logs"
  ON public.agent_run_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role access (for edge functions)
CREATE POLICY "Service role full access on agent_run_logs"
  ON public.agent_run_logs FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
