ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sort_order integer;

UPDATE public.matches AS m
SET sort_order = v.ord
FROM (VALUES
  ('m-r16-1',1),('m-r16-2',2),('m-r16-3',3),('m-r16-4',4),('m-r16-5',5),('m-r16-6',6),('m-r16-7',7),('m-r16-8',8),
  ('m-qf-1',9),('m-qf-2',10),('m-qf-3',11),('m-qf-4',12),('m-sf-1',13),('m-sf-2',14),('m-final',15),
  ('ls-bye',16),('ls-qf-1',17),('ls-qf-2',18),('ls-qf-3',19),('ls-sf-1',20),('ls-sf-2',21),('ls-final',22),
  ('lb-qf-1',23),('lb-qf-2',24),('lb-qf-3',25),('lb-qf-4',26),('lb-sf-1',27),('lb-sf-2',28),('lb-final',29)
) AS v(id, ord)
WHERE m.id = v.id;