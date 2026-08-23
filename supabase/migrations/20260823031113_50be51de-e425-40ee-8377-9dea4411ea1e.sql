ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS total_holes integer NOT NULL DEFAULT 18;
UPDATE public.matches SET total_holes = 36, updated_at = now() WHERE id = 'm-final';