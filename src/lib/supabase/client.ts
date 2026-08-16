import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_SUPABASE_CONFIGURED } from "./env";

/**
 * Browser-side Supabase client.
 * Use this only inside Client Components (`"use client"`) or event handlers.
 * The session is persisted in cookies managed by @supabase/ssr.
 *
 * If Supabase env vars are missing, returns a no-op stub so the app
 * still renders — auth calls will resolve with null sessions.
 */
export function createBrowserClient() {
  if (!IS_SUPABASE_CONFIGURED) {
    return createNoOpBrowserClient();
  }
  return createSSRBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Minimal no-op stub matching the surface area of a Supabase browser
 * client that the app actually touches (`auth.getUser`, `auth.signIn*`,
 * `auth.signOut`, `auth.onAuthStateChange`). Returns null sessions /
 * empty data so downstream code can render signed-out UI gracefully.
 */
function createNoOpBrowserClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: new Error(
          "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        ),
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: new Error(
          "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        ),
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => ({
      select: () => ({ data: [], error: null, single: async () => ({ data: null, error: null }) }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  } as unknown as ReturnType<typeof createSSRBrowserClient>;
}
