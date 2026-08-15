import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * OAuth callback. Supabase redirects here with `?code=...` after the user
 * finishes the Google/Apple flow. We exchange the code for a session, then
 * redirect to the `next` param (or /dashboard).
 *
 * This is a route handler (server-side) so we use the async `createServerClient`
 * from @/lib/supabase/server — it has access to next/headers cookies().
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // If exchange fails, redirect to signin with the error
    return NextResponse.redirect(
      `${origin}/signin?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  // No code present — shouldn't happen, but handle gracefully
  return NextResponse.redirect(`${origin}/signin?next=${encodeURIComponent(next)}`);
}
