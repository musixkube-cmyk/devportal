-- user_exists_by_email(p_email text) RETURNS boolean
--
-- Used by the signin page to decide whether to render the sign-in or sign-up
-- flow for a given email — without submitting wrong credentials first.
--
-- SECURITY: this function enables user enumeration by email. That trade-off
-- is accepted at the product level (matches the pattern used by Linear,
-- Notion, Vercel, Stripe, etc.). Access is restricted to the service_role
-- (server-side admin client only) — anon/authenticated roles cannot call it.
--
-- SECURITY DEFINER + explicit search_path prevents search-path injection.

CREATE OR REPLACE FUNCTION public.user_exists_by_email(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = lower(p_email));
$$;

REVOKE EXECUTE ON FUNCTION public.user_exists_by_email(text) FROM PUBLIC;
-- service_role inherits execute by default; no explicit grant needed.
