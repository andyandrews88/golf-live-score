CREATE OR REPLACE FUNCTION public.advance_match_winner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w_name text;
  w_seed integer;
  w_hcp integer;
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.winner IN ('p1','p2')
     AND NEW.feeds_into_match_id IS NOT NULL
     AND NEW.feeds_into_slot IN (1,2) THEN

    IF NEW.winner = 'p1' THEN
      w_name := NEW.p1_name; w_seed := NEW.p1_seed; w_hcp := NEW.p1_hcp;
    ELSE
      w_name := NEW.p2_name; w_seed := NEW.p2_seed; w_hcp := NEW.p2_hcp;
    END IF;

    IF NEW.feeds_into_slot = 1 THEN
      UPDATE public.matches
        SET p1_name = w_name, p1_seed = w_seed, p1_hcp = w_hcp, updated_at = now()
        WHERE id = NEW.feeds_into_match_id;
    ELSE
      UPDATE public.matches
        SET p2_name = w_name, p2_seed = w_seed, p2_hcp = w_hcp, updated_at = now()
        WHERE id = NEW.feeds_into_match_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_match_winner ON public.matches;
CREATE TRIGGER trg_advance_match_winner
AFTER INSERT OR UPDATE OF status, winner ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.advance_match_winner();