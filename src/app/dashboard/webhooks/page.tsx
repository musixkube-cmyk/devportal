import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Webhooks · Dashboard · Musicosy" };
export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Configure HTTP endpoints that Musicosy calls when events happen.
        </p>
      </header>

      <div className="border border-border p-12 text-center">
        <p className="font-display text-sm font-semibold">Coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Webhook configuration + delivery log will land in Phase 3.
        </p>
      </div>
    </div>
  );
}
