import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Activity, Webhook, Settings } from "lucide-react";
import { getCurrentUser, ensureDeveloperProfile } from "@/lib/session";
import { DashboardSignOutButton } from "@/components/dashboard/DashboardSignOutButton";

export const metadata = {
  title: "Dashboard · Musicosy",
  description: "Manage your Musicosy API keys, webhooks, and usage.",
};

const NAV = [
  { href: "/dashboard/keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin?next=/dashboard");
  }
  await ensureDeveloperProfile(user.id);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border lg:flex lg:flex-col">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center border border-foreground font-mono text-[11px] font-bold">
              M
            </span>
            <span className="font-display text-sm font-semibold">Musicosy</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-px p-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/docs"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to docs
          </Link>
          <DashboardSignOutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <span className="label-mono">Dashboard</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-display text-sm font-medium">
              {user.email ?? user.phone ?? "Developer"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs/api-reference"
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              API Reference →
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
