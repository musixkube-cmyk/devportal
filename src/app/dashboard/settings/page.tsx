import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Settings · Dashboard · Musicosy" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Profile fields are stored directly on auth.users.raw_user_meta_data —
  // no separate developer_profiles table, no sync, no Prisma.
  const meta = user.user_metadata ?? {};
  const displayName = (meta.display_name as string | undefined) ?? "—";
  const companyName = (meta.company_name as string | undefined) ?? "—";
  const website = (meta.website as string | undefined) ?? "—";

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
          <Row label="Display name" value={displayName} />
          <Row label="Company" value={companyName} />
          <Row label="Website" value={website} />
        </dl>
      </div>

      <p className="text-xs text-muted-foreground">
        Profile fields are stored on your Supabase auth user record. To update
        them, use the <code className="font-mono">supabase.auth.updateUser()</code> API.
      </p>
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
