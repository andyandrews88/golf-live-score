DROP POLICY IF EXISTS "App config is publicly viewable" ON public.app_config;
REVOKE ALL ON public.app_config FROM anon, authenticated;
GRANT ALL ON public.app_config TO service_role;