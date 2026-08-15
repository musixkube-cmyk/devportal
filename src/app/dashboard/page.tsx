"use client";

import Link from "next/link";
import { ArrowRight, KeyRound, Webhook, Activity } from "lucide-react";
import { useFetch } from "@/hooks/dashboard/useFetch";
import { useCurrentUser } from "@/hooks/dashboard/useCurrentUser";

type Stats = {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  webhookCount: number;
  requestsToday: number;
  requests30d: number;
};

/**
 * Dashboard overview — client component.
 *
 * The shell (sidebar + header) is already on screen by the time this
 * component mounts. We fire `/api/dashboard/stats` in a `useEffect` and
 * show skeleton placeholders for the stat cards until the data resolves.
 *
 * Total time-to-first-paint of this page: ~10ms (just JSX). Data fills in
 * ~200-500ms later depending on Supabase pooler latency.
 */
export default function DashboardHomePage() {
  const { user, loading: userLoading } = useCurrentUser();
  const { data, loading, error } = useFetch<Stats>(
    "/api/dashboard/stats",
  );

  const greeting = user?.email?.split("@")[0] ?? "developer";

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">
          {userLoading ? (
            <span className="inline-block h-7 w-48 animate-pulse bg-muted" />
          ) : (
            <>Welcome, {greeting}</>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your API access, monitor usage, and configure webhooks.
        </p>
      </header>

      {error && (
        <div className="border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load stats: {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Total keys"
          icon={<KeyRound className="size-4" />}
          value={loading ? null : data?.totalKeys ?? 0}
        />
        <Stat
          label="Active keys"
          icon={<KeyRound className="size-4" />}
          value={loading ? null : data?.activeKeys ?? 0}
        />
        <Stat
          label="Webhooks"
          icon={<Webhook className="size-4" />}
          value={loading ? null : data?.webhookCount ?? 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/keys"
          className="group block border border-border p-6 transition-colors hover:bg-surface"
        >
          <p className="font-display text-base font-semibold">
            Create an API key
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a long-lived{" "}
            <code className="font-mono">sk_live_</code> credential for your
            backend or CI.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-1">
            Go <ArrowRight className="size-3" />
          </span>
        </Link>

        <Link
          href="/docs/api-reference"
          className="group block border border-border p-6 transition-colors hover:bg-surface"
        >
          <p className="font-display text-base font-semibold">
            Browse API reference
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            27 domains, 163 resources, 399 endpoints with request/response
            schemas.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-1">
            Open <ArrowRight className="size-3" />
          </span>
        </Link>
      </div>

      {data && (data.requests30d > 0 || data.requestsToday > 0) && (
        <div className="border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="label-mono flex items-center gap-2">
              <Activity className="size-3.5" />
              Last 30 days
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {data.requestsToday} today
            </p>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">
            {data.requests30d.toLocaleString()}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              requests
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border border-border p-4">
      <p className="label-mono flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold">
        {value === null ? (
          <span className="inline-block h-7 w-12 animate-pulse bg-muted" />
        ) : (
          value.toLocaleString()
        )}
      </p>
    </div>
  );
}
