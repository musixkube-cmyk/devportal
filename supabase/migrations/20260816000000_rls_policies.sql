-- RLS policies for dashboard tables.
--
-- Modern Supabase pattern: enable Row Level Security on every user-owned
-- table, then write policies that scope rows to auth.uid(). The server-side
-- Supabase client (created via @supabase/ssr) carries the user's session
-- JWT, so every query is automatically scoped — no Prisma middleman, no
-- manual `WHERE userId = $1` clauses in app code, no chance of leaking
-- another user's data through a forgotten filter.
--
-- NOTE: column names are camelCase (Prisma created them without @map).
-- Postgres identifiers are case-folded to lowercase unless quoted, so we
-- must wrap every column reference in double quotes.
--
-- Apply with: node scripts/apply-rls-policies.mjs

-- ============================================================================
-- api_keys
-- ============================================================================
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can read only their own keys
DROP POLICY IF EXISTS "api_keys_select_own" ON public.api_keys;
CREATE POLICY "api_keys_select_own"
  ON public.api_keys
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- Users can insert keys only for themselves
DROP POLICY IF EXISTS "api_keys_insert_own" ON public.api_keys;
CREATE POLICY "api_keys_insert_own"
  ON public.api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

-- Users can update only their own keys (e.g. revoke, roll)
DROP POLICY IF EXISTS "api_keys_update_own" ON public.api_keys;
CREATE POLICY "api_keys_update_own"
  ON public.api_keys
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

-- No DELETE policy — keys are soft-revoked for audit history.

-- ============================================================================
-- webhooks
-- ============================================================================
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhooks_select_own" ON public.webhooks;
CREATE POLICY "webhooks_select_own"
  ON public.webhooks
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "webhooks_insert_own" ON public.webhooks;
CREATE POLICY "webhooks_insert_own"
  ON public.webhooks
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "webhooks_update_own" ON public.webhooks;
CREATE POLICY "webhooks_update_own"
  ON public.webhooks
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "webhooks_delete_own" ON public.webhooks;
CREATE POLICY "webhooks_delete_own"
  ON public.webhooks
  FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- ============================================================================
-- audit_logs — read-only by owner, write-only via service role
-- (inserts happen server-side with admin client, never user-side)
-- ============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;
CREATE POLICY "audit_logs_select_own"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- No INSERT/UPDATE/DELETE policies — only service_role (server-side admin)
-- can write audit logs, and service_role bypasses RLS by default.
