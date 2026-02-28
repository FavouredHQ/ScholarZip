
-- Saved scholarships table for "Save for Later" feature
CREATE TABLE public.saved_scholarships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, scholarship_id)
);

ALTER TABLE public.saved_scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved scholarships"
ON public.saved_scholarships FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can save scholarships"
ON public.saved_scholarships FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave scholarships"
ON public.saved_scholarships FOR DELETE
USING (auth.uid() = user_id);
