import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/check-email
 * Body: { email: string }
 * Returns: { exists: boolean }
 *
 * Used by the signin page to decide whether to render the sign-in flow
 * (email already registered) or the sign-up flow (new user) — without
 * requiring the user to submit wrong credentials first.
 *
 * Implementation: calls the `public.user_exists_by_email(text)` Postgres
 * function via the Supabase service-role client's `rpc()` method. Auth is
 * 100% Supabase's domain — Prisma is not involved.
 *
 * Security note: this endpoint enables user enumeration by email. That is
 * an explicit UX trade-off the product has accepted (matches the pattern
 * used by Linear, Notion, Vercel, Stripe, etc.). The RPC is only callable
 * with the service_role key — anon/authenticated roles cannot invoke it
 * directly.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("user_exists_by_email", {
    p_email: email,
  });

  if (error) {
    return NextResponse.json(
      { error: "lookup failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ exists: Boolean(data) });
}
