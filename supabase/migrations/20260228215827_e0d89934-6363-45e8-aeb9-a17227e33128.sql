
-- Education history table for repeater field onboarding
CREATE TABLE public.education_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  degree_type TEXT NOT NULL,
  institution TEXT NOT NULL,
  course TEXT,
  grade TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own education history"
  ON public.education_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own education history"
  ON public.education_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own education history"
  ON public.education_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own education history"
  ON public.education_history FOR DELETE
  USING (auth.uid() = user_id);

-- Add target_courses to profiles for step 2 of onboarding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_courses TEXT[] DEFAULT '{}';

-- Add onboarding_completed flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
