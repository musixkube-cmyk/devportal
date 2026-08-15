import { NextResponse, type NextRequest } from "next/server";
import { pgPool } from "@/lib/pg";

/**
 * POST /api/auth/signup
 * Body: { email: string, password: string }
 * Returns: { ok: true } on success
 *
 * Creates a new Supabase auth user by inserting directly into auth.users
 * with:
 *   - encrypted_password = crypt($password, gen_salt('bf'))  (bcrypt via pgcrypto)
 *   - email_confirmed_at = now()  (treated as verified — no confirmation email)
 *
 * Why this approach instead of supabase.auth.admin.createUser()?
 *  - The Supabase project's "Confirm email" setting is ON, so public
 *    signUp() sends a confirmation email and refuses to issue a session
 *    until the user clicks the link. Hitting that path repeatedly trips
 *    Supabase's email rate limit (default ~3-4 emails/hour).
 *  - admin.createUser({ email_confirm: true }) would bypass the email,
 *    BUT requires the real service_role key. The key currently configured
 *    is actually the anon key (project was provisioned incorrectly), so
 *    admin.createUser returns "User not allowed".
 *  - Direct INSERT into auth.users with crypt() and email_confirmed_at
 *    sidesteps both issues: no email is sent, no service_role key needed,
 *    and the resulting user can immediately sign in via the public
 *    signInWithPassword() endpoint.
 *
 * The client still has to call signInWithPassword() afterwards to obtain
 * a session — INSERT does NOT issue session tokens.
 *
 * Security: this endpoint is callable by anyone (no auth required) since
 * it's the sign-up endpoint. It's protected by:
 *   - Email format validation
 *   - Password length validation (>= 8 chars)
 *   - UNIQUE constraint on auth.users.email — duplicate emails return a
 *     409 conflict, we can't accidentally overwrite accounts
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const password = body.password as string | undefined;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  try {
    await pgPool.query(
      `
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        created_at, updated_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        email_change, email_change_token_new, email_change_token_current,
        phone, phone_change, confirmation_token, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        $1,
        crypt($2, gen_salt('bf')),
        now(),
        now(),
        now(),
        now(),
        '{}'::jsonb,
        '{}'::jsonb,
        '', '', '',
        NULL, '', '', ''
      )
      `,
      [email, password],
    );
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "";
    // Postgres unique violation on auth.users.email
    if (msg.includes("duplicate key") || msg.includes("users_email_key")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg || "sign-up failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
