import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";
import { hashApiKey, generateApiKey } from "@/lib/api-keys";

/**
 * GET /api/dashboard/keys — list current user's API keys (no raw secrets)
 *
 * RLS scopes the query to the current user — no `WHERE userId = ...` needed.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createServerClient();
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select(
      "id, label, prefix, lastFour, scopes, revokedAt, expiresAt, lastUsedAt, createdAt",
    )
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: keys ?? [] });
}

/**
 * POST /api/dashboard/keys — create a new API key
 * Body: { label: string, scopes?: string, expiresAt?: string | null }
 *
 * Returns the raw secret ONCE. Client must store it; we never persist it.
 *
 * RLS policy `api_keys_insert_own` checks `userId = auth.uid()::text`, so
 * even if a malicious client tried to set `userId` to someone else, the
 * insert would be rejected.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const label = (body.label as string | undefined)?.trim();
  const scopes = (body.scopes as string | undefined)?.trim() || "read:all,write:all";
  const expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null;

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (expiresAt && isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "expiresAt is not a valid ISO date" }, { status: 400 });
  }

  // Generate the raw secret + its hash + display prefix/last4
  const { rawSecret, hashedKey, prefix, lastFour } = generateApiKey();

  const supabase = await createServerClient();

  // Insert — RLS will verify userId matches auth.uid()
  const { data: created, error } = await supabase
    .from("api_keys")
    .insert({
      userId: user.id,
      label,
      hashedKey,
      prefix,
      lastFour,
      scopes,
      expiresAt: expiresAt?.toISOString() ?? null,
    })
    .select("id, label")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log — best effort, don't fail the request if this fails.
  // Uses admin client (service_role bypasses RLS) so we can INSERT into
  // audit_logs which has no INSERT policy for authenticated users.
  // Skipping the admin client for now to avoid the service_role key issue;
  // audit logging will be re-enabled when the real service_role key is
  // provisioned.

  // Return the raw secret — this is the ONLY time it leaves the server.
  return NextResponse.json({
    id: created.id,
    label: created.label,
    rawSecret, // the full `sk_live_<random>` — client must store
  });
}
