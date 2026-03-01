
-- Job locks table for preventing overlapping runs
CREATE TABLE public.job_locks (
  job_name text PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

-- Only service role can manage locks
CREATE POLICY "Service role full access on job_locks"
  ON public.job_locks FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
