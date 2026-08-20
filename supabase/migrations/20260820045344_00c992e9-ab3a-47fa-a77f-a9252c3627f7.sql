CREATE TABLE public.course_info (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_info TO anon;
GRANT SELECT ON public.course_info TO authenticated;
GRANT ALL ON public.course_info TO service_role;

ALTER TABLE public.course_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Course info is publicly viewable"
  ON public.course_info FOR SELECT
  TO anon, authenticated
  USING (true);