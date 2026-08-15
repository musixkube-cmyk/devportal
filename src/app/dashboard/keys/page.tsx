import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { KeysList } from "@/components/dashboard/KeysList";

export const metadata = {
  title: "API Keys · Dashboard · Musicosy",
};

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      prefix: true,
      lastFour: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-8">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold">API Keys</h1>
          <p className="label-mono text-muted-foreground">{keys.length} total</p>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Long-lived server-to-server credentials for the Musicosy API. Use a
          separate key per environment (production, staging, CI). Keys are
          hashed at rest — the raw <code className="font-mono text-foreground">sk_live_…</code> value
          is shown <strong className="text-foreground">once</strong> when you create a key. Store it in a secret manager.
        </p>
      </header>

      <KeysList initialKeys={keys} />
    </div>
  );
}
