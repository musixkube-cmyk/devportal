import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

/**
 * Returns the current Supabase user, or null if not authenticated.
 * Server-only. Use inside Server Components / Route Handlers / Server Actions.
 */
export async function getCurrentUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the current user, throwing a redirect to /signin if not authenticated.
 * Use at the top of any /dashboard/* Server Component.
 *
 * Usage:
 *   const user = await requireUser();
 *
 * We import NextResponse lazily to avoid bundling next/server into client.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/signin?next=" + encodeURIComponent(
      // We don't have access to the pathname here; middleware already set it.
      "/dashboard",
    ));
  }
  return user;
}

/**
 * Ensures the user has a DeveloperProfile row. Call once on dashboard entry.
 * Idempotent — safe to call on every dashboard page load.
 */
export async function ensureDeveloperProfile(userId: string) {
  return db.developerProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}
