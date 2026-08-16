import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { IS_SUPABASE_CONFIGURED } from "@/lib/supabase/env";

/**
 * Middleware runs on every matched request. Two responsibilities:
 *
 * 1. Refresh the Supabase auth session (the @supabase/ssr pattern). The
 *    library handles the actual JWT refresh; we just propagate the updated
 *    cookies back into the request and the response.
 * 2. Guard /dashboard/* routes — if the user has no session, redirect to
 *    /signin?next=<original-path> so we can resume after they auth.
 * 3. Bounce logged-in users away from /signin so they don't get stuck
 *    re-authenticating when they already have a valid session.
 *
 * The matcher excludes static assets, Next internals, and image files so we
 * don't pay the cost on hot static requests.
 */
export async function middleware(request: NextRequest) {
  // When Supabase is not configured, the app runs in "no auth" mode:
  // middleware passes through, dashboard routes may show empty data
  // instead of bouncing to /signin.
  if (!IS_SUPABASE_CONFIGURED) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

  // Refreshes session if expired; mutates response cookies when it does.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Guard /dashboard/*
  const isDashboard = pathname.startsWith("/dashboard");
  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // If already logged in and visiting /signin, send to dashboard.
  if (user && pathname === "/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static, _next/image, favicon.ico  (static)
     *  - Any file with an extension (images, fonts, etc.)
     *  - /api/* — those are route handlers, they do their own auth
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};
