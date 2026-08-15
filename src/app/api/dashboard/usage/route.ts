import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/usage — last 30 days of per-day usage aggregates for
 * the current user.
 *
 * Returns:
 *   rows: { day, requestCount, errorCount, p50Ms, p99Ms, topEndpoint }[]
 *   totalRequests: number
 *   totalErrors: number
 *   avgP50: number (mean across days with >0 requests)
 *   avgP99: number
 *   topEndpoints: { endpoint, count }[] (top 10 across the 30d window)
 *
 * RLS scopes queries to the current user.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const { data: rows, error } = await supabase
    .from("usage_daily")
    .select(
      "day, requestCount, errorCount, p50Ms, p99Ms, topEndpoint",
    )
    .gte("day", thirtyDaysAgo.toISOString())
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rows ?? [];

  // Aggregate per-day rows into a single day-bucket (multiple keys can
  // contribute to the same calendar day).
  const byDay = new Map<
    string,
    {
      day: string;
      requestCount: number;
      errorCount: number;
      p50Max: number;
      p99Max: number;
      topEndpoint: string | null;
    }
  >();
  const endpointCounts = new Map<string, number>();

  for (const r of list) {
    const dayKey = String(r.day).slice(0, 10);
    const entry = byDay.get(dayKey) ?? {
      day: dayKey,
      requestCount: 0,
      errorCount: 0,
      p50Max: 0,
      p99Max: 0,
      topEndpoint: null,
    };
    entry.requestCount += r.requestCount ?? 0;
    entry.errorCount += r.errorCount ?? 0;
    entry.p50Max = Math.max(entry.p50Max, r.p50Ms ?? 0);
    entry.p99Max = Math.max(entry.p99Max, r.p99Ms ?? 0);
    if (r.topEndpoint) {
      entry.topEndpoint = r.topEndpoint;
      endpointCounts.set(
        r.topEndpoint,
        (endpointCounts.get(r.topEndpoint) ?? 0) + (r.requestCount ?? 0),
      );
    }
    byDay.set(dayKey, entry);
  }

  const aggregated = Array.from(byDay.values());
  const totalRequests = aggregated.reduce((s, r) => s + r.requestCount, 0);
  const totalErrors = aggregated.reduce((s, r) => s + r.errorCount, 0);
  const daysWithTraffic = aggregated.filter((r) => r.requestCount > 0);
  const avgP50 = daysWithTraffic.length
    ? Math.round(
        daysWithTraffic.reduce((s, r) => s + r.p50Max, 0) /
          daysWithTraffic.length,
      )
    : 0;
  const avgP99 = daysWithTraffic.length
    ? Math.round(
        daysWithTraffic.reduce((s, r) => s + r.p99Max, 0) /
          daysWithTraffic.length,
      )
    : 0;

  const topEndpoints = Array.from(endpointCounts.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    rows: aggregated.map((r) => ({
      day: r.day,
      requestCount: r.requestCount,
      errorCount: r.errorCount,
      p50Ms: r.p50Max,
      p99Ms: r.p99Max,
      topEndpoint: r.topEndpoint,
    })),
    totalRequests,
    totalErrors,
    avgP50,
    avgP99,
    topEndpoints,
  });
}
