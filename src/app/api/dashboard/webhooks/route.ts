import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";
import { createHash, randomBytes } from "node:crypto";

/**
 * Webhook secret generation.
 *
 * Format: whsec_<43 chars url-safe base64>
 *
 * Storage mirrors API keys: we keep only the sha-256 hash + an 8-char prefix
 * for display in the dashboard. The raw secret is shown ONCE at creation.
 */
const SECRET_PREFIX = "whsec_";
function generateWebhookSecret() {
  const random = randomBytes(32);
  const tail = random.toString("base64url");
  const rawSecret = `${SECRET_PREFIX}${tail}`;
  return {
    rawSecret,
    secretHash: createHash("sha256").update(rawSecret).digest("hex"),
    secretPrefix: tail.slice(0, 8),
  };
}

/**
 * GET /api/dashboard/webhooks — list current user's webhooks.
 *
 * Never returns secretHash — only the secretPrefix for display.
 * RLS scopes to the current user.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data: webhooks, error } = await supabase
    .from("webhooks")
    .select(
      "id, label, url, events, enabled, secretPrefix, lastDeliveryAt, lastDeliveryStatus, createdAt",
    )
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ webhooks: webhooks ?? [] });
}

/**
 * POST /api/dashboard/webhooks — create a new webhook.
 *
 * Body: { label, url, events }
 * Returns: { id, label, rawSecret } — rawSecret shown ONCE.
 *
 * RLS policy `webhooks_insert_own` checks `userId = auth.uid()::text`, so
 * even if a malicious client set `userId` to someone else, the insert would
 * be rejected.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const label = (body.label as string | undefined)?.trim();
  const url = (body.url as string | undefined)?.trim();
  const events = (body.events as string | undefined)?.trim();

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json(
      { error: "url must start with http:// or https://" },
      { status: 400 },
    );
  }
  if (!events) {
    return NextResponse.json(
      { error: "at least one event type is required" },
      { status: 400 },
    );
  }

  const { rawSecret, secretHash, secretPrefix } = generateWebhookSecret();

  const supabase = await createServerClient();
  const { data: created, error } = await supabase
    .from("webhooks")
    .insert({
      userId: user.id,
      label,
      url,
      events,
      secretHash,
      secretPrefix,
      enabled: true,
    })
    .select("id, label")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: created.id,
    label: created.label,
    rawSecret,
  });
}
