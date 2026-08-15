import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { hashApiKey, generateApiKey } from "@/lib/api-keys";

/**
 * GET /api/dashboard/keys — list current user's API keys (no raw secrets)
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      prefix: true,
      lastFour: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

/**
 * POST /api/dashboard/keys — create a new API key
 * Body: { label: string, scopes?: string, expiresAt?: string | null }
 *
 * Returns the raw secret ONCE. Client must store it; we never persist it.
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

  const created = await db.apiKey.create({
    data: {
      userId: user.id,
      label,
      hashedKey,
      prefix,
      lastFour,
      scopes,
      expiresAt,
    },
    select: { id: true, label: true },
  });

  // Audit log (best-effort — don't fail the request if this fails)
  await db.auditLog
    .create({
      data: {
        userId: user.id,
        action: "api_key.create",
        subject: { apiKeyId: created.id, label },
      },
    })
    .catch(() => undefined);

  // Return the raw secret — this is the ONLY time it leaves the server.
  return NextResponse.json({
    id: created.id,
    label: created.label,
    rawSecret, // the full `sk_live_<random>` — client must store
  });
}
