
-- Admin full access on source_hubs
CREATE POLICY "Admin full access on source_hubs"
  ON public.source_hubs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin full access on url_queue
CREATE POLICY "Admin full access on url_queue"
  ON public.url_queue FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can view all scholarships including inactive
CREATE POLICY "Admin can view all scholarships"
  ON public.scholarships FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can manage all scholarships
CREATE POLICY "Admin can manage all scholarships"
  ON public.scholarships FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
