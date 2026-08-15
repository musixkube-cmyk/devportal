import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Musicosy" };
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const user = await getCurrentUser();
  if (!user) return null;

  // RLS scopes every query to the current user — no `WHERE userId = $1`
  // needed. The Supabase server client carries the session JWT from the
  // cookie, so Postgres sees auth.uid() = user.id and the RLS policies
  // filter automatically.
  const supabase = await createServerClient();

  const [
    { count: keyCount },
    { count: activeKeyCount },
    { count: webhookCount },
  ] = await Promise.all([
    supabase.from("api_keys").select("*", { count: "exact", head: true }),
    supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .is("revokedAt", null),
    supabase.from("webhooks").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">
          Welcome, {user.email?.split("@")[0] ?? "developer"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your API access, monitor usage, and configure webhooks.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total keys" value={keyCount ?? 0} />
        <Stat label="Active keys" value={activeKeyCount ?? 0} />
        <Stat label="Webhooks" value={webhookCount ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/keys"
          className="group block border border-border p-6 transition-colors hover:bg-surface"
        >
          <p className="font-display text-base font-semibold">Create an API key</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a long-lived <code className="font-mono">sk_live_</code> credential for your backend or CI.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-1">
            Go <ArrowRight className="size-3" />
          </span>
        </Link>

        <Link
          href="/docs/api-reference"
          className="group block border border-border p-6 transition-colors hover:bg-surface"
        >
          <p className="font-display text-base font-semibold">Browse API reference</p>
          <p className="mt-1 text-xs text-muted-foreground">
            27 domains, 163 resources, 399 endpoints with request/response schemas.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-1">
            Open <ArrowRight className="size-3" />
          </span>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-4">
      <p className="label-mono">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
