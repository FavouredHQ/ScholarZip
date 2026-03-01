ALTER TABLE public.url_queue ADD COLUMN confidence_score numeric DEFAULT NULL;
ALTER TABLE public.url_queue ADD COLUMN screenshot_url text DEFAULT NULL;
COMMENT ON COLUMN public.url_queue.confidence_score IS 'Confidence score from the extraction agent';
COMMENT ON COLUMN public.url_queue.screenshot_url IS 'Screenshot URL from vision-based agent for debugging';