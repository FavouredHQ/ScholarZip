
-- Fix permissive INSERT policy on matches - restrict to authenticated service role or provider context
DROP POLICY "System can insert matches" ON matches;
CREATE POLICY "Authenticated can insert matches" ON matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
