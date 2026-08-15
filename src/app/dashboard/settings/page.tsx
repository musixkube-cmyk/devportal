import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata = { title: "Settings · Dashboard · Musicosy" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await db.developerProfile.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your developer profile and account details.
        </p>
      </header>

      <div className="border border-border">
        <dl className="divide-y divide-border">
          <Row label="Account email" value={user.email ?? "—"} />
          <Row label="Phone" value={user.phone ?? "—"} />
          <Row label="User ID" value={user.id} mono />
          <Row label="Display name" value={profile?.displayName ?? "—"} />
          <Row label="Company" value={profile?.companyName ?? "—"} />
          <Row label="Tier" value={profile?.tier ?? "free"} />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="label-mono text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
