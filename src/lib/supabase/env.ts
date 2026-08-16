// Shared constants for Supabase clients.
// Reads from process.env (server) and NEXT_PUBLIC_ env (browser).
//
// When env vars are missing, all values fall back to "" and the
// Supabase client factories return a no-op stub instead of throwing.
// This lets the app boot (and render marketing/docs pages) without
// Supabase credentials configured.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (typeof window !== "undefined"
    ? (window as unknown as { __SUPABASE_URL__?: string }).__SUPABASE_URL__
    : undefined) ??
  "";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  (typeof window !== "undefined"
    ? (window as unknown as { __SUPABASE_ANON_KEY__?: string }).__SUPABASE_ANON_KEY__
    : undefined) ??
  "";

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Cookie name used by @supabase/ssr to store the session. The library picks
// `sb-<project-ref>-auth-token` by default — we don't override it.
export const AUTH_COOKIE_NAME = `sb-${
  SUPABASE_URL.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "unknown"
}-auth-token`;

/** True when real Supabase credentials are configured. */
export const IS_SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY,
);
