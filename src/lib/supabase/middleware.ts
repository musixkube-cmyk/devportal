import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_SUPABASE_CONFIGURED } from "./env";

/**
 * Supabase client for use inside `middleware.ts`.
 * Uses the raw `NextRequest.cookies` API (sync) — next/headers cookies() is
 * unavailable in middleware.
 *
 * When Supabase is not configured, returns a stub client so middleware
 * runs without throwing — it will treat all requests as unauthenticated.
 */
export function createMiddlewareClient(request: NextRequest) {
  // Create a synthetic response that we'll mutate then return from middleware.
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!IS_SUPABASE_CONFIGURED) {
    return {
      supabase: {
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
          getSession: async () => ({ data: { session: null }, error: null }),
        },
      } as unknown as ReturnType<typeof createServerClient>,
      response,
    };
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  return { supabase, response };
}
