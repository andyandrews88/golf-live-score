CREATE OR REPLACE FUNCTION public.set_match_sort_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO NEW.sort_order FROM public.matches;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_match_sort_order
BEFORE INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.set_match_sort_order();

UPDATE public.matches m
SET sort_order = s.rn
FROM (
  SELECT id, (SELECT COALESCE(MAX(sort_order),0) FROM public.matches) + ROW_NUMBER() OVER (ORDER BY match_date, id) AS rn
  FROM public.matches WHERE sort_order IS NULL
) s
WHERE m.id = s.id AND m.sort_order IS NULL;

ALTER TABLE public.matches ALTER COLUMN sort_order SET NOT NULL;