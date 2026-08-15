"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  KeyRound,
  Activity,
  Webhook,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { useCurrentUser, invalidateCurrentUser } from "@/hooks/dashboard/useCurrentUser";
import { invalidateAll } from "@/hooks/dashboard/useFetch";
import { DashboardSignOutButton } from "@/components/dashboard/DashboardSignOutButton";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

/**
 * DashboardShell — the static app shell.
 *
 * This component mounts INSTANTLY. It does NOT call any Supabase / DB / API
 * endpoint to render its structure. The sidebar, header chrome, and main
 * container are all present on first paint.
 *
 * The ONLY dynamic piece is the user's email in the header, which is fetched
 * via `useCurrentUser()` (a fire-and-forget call to /api/me). While that
 * resolves, we show a small skeleton — the shell itself is already on
 * screen.
 *
 * Auth gating lives in middleware — if there's no session, the user is
 * redirected to /signin before this component ever mounts.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useCurrentUser();

  // Derive the current section name for the breadcrumb in the header.
  const currentSection =
    NAV.find((n) => n.href === pathname)?.label ??
    (pathname.startsWith("/dashboard/keys") ? "API Keys" : "Dashboard");

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
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/docs"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to docs
          </Link>
          <DashboardSignOutButton
            onSignedOut={() => {
              // Flush all caches so the next sign-in starts fresh.
              invalidateCurrentUser();
              invalidateAll();
            }}
          />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <span className="label-mono">Dashboard</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-display text-sm font-medium">
              {currentSection}
            </span>
            <span className="text-muted-foreground">·</span>
            {/* Email — fetched client-side. Skeleton until it resolves. */}
            {loading ? (
              <span
                aria-busy="true"
                className="inline-block h-3 w-40 animate-pulse bg-muted"
              />
            ) : user?.email ? (
              <span className="font-mono text-xs text-muted-foreground">
                {user.email}
              </span>
            ) : null}
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
