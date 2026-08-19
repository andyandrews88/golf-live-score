DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.matches; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hole_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.hole_results REPLICA IDENTITY FULL;