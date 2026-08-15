import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/auth/check-email
 * Body: { email: string }
 * Returns: { exists: boolean }
 *
 * Used by the signin page to decide whether to render the sign-in flow
 * (email already registered) or the sign-up flow (new user) — without
 * requiring the user to submit wrong credentials first.
 *
 * Implementation: direct query against Supabase's auth.users table via
 * Prisma's $queryRaw (parameterized — safe from SQL injection).
 *
 * Security note: this endpoint enables user enumeration by email. That is
 * an explicit UX trade-off the product has accepted (matches the pattern
 * used by Linear, Notion, Vercel, Stripe, etc.).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const rows = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = ${email}) AS exists
  `;

  return NextResponse.json({ exists: Boolean(rows[0]?.exists) });
}
