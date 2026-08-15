import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/stats — overview numbers for the dashboard home page.
 *
 * Returns:
 *   - totalKeys: count of all the user's API keys (incl. revoked)
 *   - activeKeys: count of non-revoked keys
 *   - revokedKeys: count of revoked keys
 *   - webhookCount: count of the user's webhooks
 *   - requestsToday: sum of requestCount across today's usage_daily rows
 *   - requests30d: sum of requestCount across last 30 days
 *
 * RLS scopes every query to the current user — no `WHERE userId = ...`
 * needed.
 *
 * Called client-side on dashboard mount (non-blocking — the shell is
 * already on screen).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  // Fire all count queries in parallel — Supabase handles them as separate
  // Postgres queries, but they share one HTTP/2 connection.
  const [
    { count: totalKeys },
    { count: activeKeys },
    { count: revokedKeys },
    { count: webhookCount },
  ] = await Promise.all([
    supabase.from("api_keys").select("*", { count: "exact", head: true }),
    supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .is("revokedAt", null),
    supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .not("revokedAt", "is", null),
    supabase.from("webhooks").select("*", { count: "exact", head: true }),
  ]);

  // Usage stats — sum of requestCount over the last 30 days. We select
  // individual rows so we can sum client-side AND also compute "today".
  // For very heavy users this would be paginated; for now we cap at 30
  // rows (one per day per active key) which is small.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const { data: usageRows } = await supabase
    .from("usage_daily")
    .select("day, requestCount")
    .gte("day", thirtyDaysAgo.toISOString());

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  let requestsToday = 0;
  let requests30d = 0;
  if (usageRows) {
    for (const r of usageRows) {
      requests30d += r.requestCount ?? 0;
      if (new Date(r.day).getTime() >= todayUTC.getTime()) {
        requestsToday += r.requestCount ?? 0;
      }
    }
  }

  return NextResponse.json({
    totalKeys: totalKeys ?? 0,
    activeKeys: activeKeys ?? 0,
    revokedKeys: revokedKeys ?? 0,
    webhookCount: webhookCount ?? 0,
    requestsToday,
    requests30d,
  });
}
