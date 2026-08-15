import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard · Musicosy",
  description: "Manage your Musicosy API keys, webhooks, and usage.",
};

/**
 * DashboardLayout — thin server component.
 *
 * NO database calls. NO Supabase calls. NO `getCurrentUser()`.
 *
 * The auth gate is enforced by `middleware.ts`, which redirects to /signin
 * before this layout ever renders. The shell itself is a client component
 * (`DashboardShell`) that mounts instantly and fetches its own user data via
 * `/api/me` from inside a `useEffect`.
 *
 * This is the modern non-blocking pattern:
 *   1. Middleware validates the session cookie (cheap, runs on the edge).
 *   2. This layout returns static HTML in ~10ms.
 *   3. The client shell hydrates and fires `/api/me` + per-page data fetches.
 *   4. Skeletons show while data loads.
 *
 * Total time-to-shell-paint: under 100ms regardless of Supabase latency.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
