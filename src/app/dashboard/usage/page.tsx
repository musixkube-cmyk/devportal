"use client";

import { useFetch } from "@/hooks/dashboard/useFetch";

type UsageRow = {
  day: string; // ISO date
  requestCount: number;
  errorCount: number;
  p50Ms: number;
  p99Ms: number;
  topEndpoint: string | null;
};

type Usage = {
  rows: UsageRow[];
  totalRequests: number;
  totalErrors: number;
  avgP50: number;
  avgP99: number;
  topEndpoints: { endpoint: string; count: number }[];
};

/**
 * Usage page — client component.
 *
 * Fires `/api/dashboard/usage` on mount, renders a sparkline + table of the
 * last 30 days of per-key aggregated usage. While loading, shows skeleton
 * placeholders for the chart area and the table rows.
 *
 * No server-side pre-fetch — the dashboard shell is on screen instantly.
 */
export default function UsagePage() {
  const { data, loading, error } = useFetch<Usage>("/api/dashboard/usage");

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Per-key request volume, error rate, and latency over the last 30
          days.
        </p>
      </header>

      {error && (
        <div className="border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load usage: {error}
        </div>
      )}

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile
          label="Requests (30d)"
          value={loading ? null : data?.totalRequests}
        />
        <StatTile
          label="Errors (30d)"
          value={loading ? null : data?.totalErrors}
          tone={data && data.totalErrors > 0 ? "warn" : undefined}
        />
        <StatTile
          label="Avg p50"
          value={loading ? null : data?.avgP50}
          unit="ms"
        />
        <StatTile
          label="Avg p99"
          value={loading ? null : data?.avgP99}
          unit="ms"
        />
      </div>

      {/* Sparkline */}
      <div className="border border-border p-4">
        <p className="label-mono mb-3">Daily request volume</p>
        {loading ? (
          <div className="h-32 w-full animate-pulse bg-muted" />
        ) : data && data.rows.length > 0 ? (
          <Sparkline rows={data.rows} />
        ) : (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No usage data yet. Make your first API request to populate this.
          </div>
        )}
      </div>

      {/* Top endpoints */}
      {data && data.topEndpoints.length > 0 && (
        <div className="border border-border">
          <div className="border-b border-border bg-surface px-4 py-2.5">
            <p className="label-mono">Top endpoints</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.topEndpoints.map((e, i) => (
                <tr key={e.endpoint} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.endpoint}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {e.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily breakdown table */}
      <div className="border border-border">
        <div className="border-b border-border bg-surface px-4 py-2.5">
          <p className="label-mono">Daily breakdown</p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-full animate-pulse bg-muted" />
            ))}
          </div>
        ) : data && data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2.5 label-mono">Day</th>
                  <th className="px-4 py-2.5 label-mono text-right">Requests</th>
                  <th className="px-4 py-2.5 label-mono text-right">Errors</th>
                  <th className="px-4 py-2.5 label-mono text-right">p50</th>
                  <th className="px-4 py-2.5 label-mono text-right">p99</th>
                  <th className="px-4 py-2.5 label-mono">Top endpoint</th>
                </tr>
              </thead>
              <tbody>
                {[...data.rows].reverse().map((r) => (
                  <tr key={r.day} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDay(r.day)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {r.requestCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {r.errorCount > 0 ? (
                        <span className="text-destructive">
                          {r.errorCount.toLocaleString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {r.p50Ms ? `${r.p50Ms}ms` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {r.p99Ms ? `${r.p99Ms}ms` : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.topEndpoint ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No usage data yet.
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  tone?: "warn";
}) {
  return (
    <div className="border border-border p-4">
      <p className="label-mono">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          tone === "warn" ? "text-destructive" : ""
        }`}
      >
        {value === null || value === undefined ? (
          <span className="inline-block h-7 w-16 animate-pulse bg-muted" />
        ) : (
          <>
            {value.toLocaleString()}
            {unit && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}

function Sparkline({ rows }: { rows: UsageRow[] }) {
  // Build an SVG sparkline of requestCount over the last 30 days.
  const sorted = [...rows].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );
  const max = Math.max(...sorted.map((r) => r.requestCount), 1);
  const w = 800;
  const h = 120;
  const pad = 4;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const stepX = sorted.length > 1 ? innerW / (sorted.length - 1) : 0;
  const points = sorted
    .map((r, i) => {
      const x = pad + i * stepX;
      const y = pad + innerH - (r.requestCount / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-32 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* baseline */}
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.3"
      />
    </svg>
  );
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
