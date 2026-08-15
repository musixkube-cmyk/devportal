import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";

/**
 * PATCH /api/dashboard/webhooks/[id]
 * Body: { enabled?: boolean, label?: string, url?: string, events?: string }
 *
 * Used by the dashboard to toggle a webhook's enabled flag (and optionally
 * update other fields). RLS scopes the update to the current user.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.label === "string" && body.label.trim()) {
    patch.label = body.label.trim();
  }
  if (typeof body.url === "string" && /^https?:\/\//.test(body.url)) {
    patch.url = body.url.trim();
  }
  if (typeof body.events === "string" && body.events.trim()) {
    patch.events = body.events.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no valid fields to update" },
      { status: 400 },
    );
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("webhooks")
    .update(patch)
    .eq("id", id)
    .select("id, enabled")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ webhook: data });
}

/**
 * DELETE /api/dashboard/webhooks/[id]
 *
 * Hard-deletes the webhook. We don't soft-delete because webhook configs
 * contain secrets (hashes) and there's no value in keeping a revoked one
 * around — the user can always recreate.
 *
 * RLS scopes the delete to the current user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const supabase = await createServerClient();
  const { error } = await supabase.from("webhooks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
