CREATE TABLE public.course_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_photos TO anon, authenticated;
GRANT ALL ON public.course_photos TO service_role;
ALTER TABLE public.course_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Course photos are publicly viewable" ON public.course_photos FOR SELECT USING (true);
CREATE INDEX course_photos_display_order_idx ON public.course_photos (display_order);