import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_SUPABASE_CONFIGURED } from "./env";

/**
 * Server-side Supabase client for Server Components and Server Actions.
 * Reads + writes session cookies via the `next/headers` cookies() API.
 *
 * Important: this function MUST be awaited — `cookies()` is async in
 * Next.js 15+ (App Router). Always call it inside `await`.
 *
 * If Supabase env vars are missing, returns a no-op stub so the app
 * still renders.
 */
export async function createServerClient() {
  if (!IS_SUPABASE_CONFIGURED) {
    return createNoOpServerClient();
  }

  const cookieStore = await cookies();

  return createSSRServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — can't write cookies there.
          // Safe to ignore; middleware will refresh the session.
        }
      },
    },
  });
}

function createNoOpServerClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ data: [], error: null, single: async () => ({ data: null, error: null }) }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  } as unknown as Awaited<ReturnType<typeof createSSRServerClient>>;
}
