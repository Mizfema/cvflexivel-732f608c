
-- Revoke execute from public on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is intentionally callable by authenticated (used inside RLS policies)
-- Revoke from anon at minimum
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Add explicit deny policies on internal tables to silence "RLS enabled, no policy" lint.
-- user_roles: nobody reads via API (only service_role bypasses RLS)
CREATE POLICY "No direct access to user_roles" ON public.user_roles FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- reliefweb_cache: only service_role accesses
CREATE POLICY "No direct access to reliefweb_cache" ON public.reliefweb_cache FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
