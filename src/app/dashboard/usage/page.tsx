import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Usage · Dashboard · Musicosy" };
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Per-key request volume, error rate, and latency over the last 30 days.
        </p>
      </header>

      <div className="border border-border p-12 text-center">
        <p className="font-display text-sm font-semibold">Coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sparkline charts + endpoint breakdown will land in Phase 3.
        </p>
      </div>
    </div>
  );
}
