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
    error: userError,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");

  // TEMP DEBUG: log cookie state on /dashboard requests so we can see
  // why middleware is bouncing authenticated users back to /signin.
  if (isDashboard) {
    const allCookies = request.cookies.getAll();
    const sbCookies = allCookies.filter((c) =>
      c.name.startsWith("sb-"),
    );
    console.log(
      `[middleware DEBUG] ${request.method} ${pathname} — user=${
        user ? user.id : "null"
      } userError=${userError?.message ?? "none"} sbCookies=${sbCookies.length} totalCookies=${allCookies.length}`,
    );
    if (sbCookies.length === 0 && allCookies.length > 0) {
      console.log(
        `[middleware DEBUG] cookies present but no sb-* cookies:`,
        allCookies.map((c) => c.name),
      );
    }
  }

  // Guard /dashboard/*
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
