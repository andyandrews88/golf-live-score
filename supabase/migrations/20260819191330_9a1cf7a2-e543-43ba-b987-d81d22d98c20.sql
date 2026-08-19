ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS quick_thru integer,
  ADD COLUMN IF NOT EXISTS quick_diff integer,
  ADD COLUMN IF NOT EXISTS quick_updated_at timestamptz;