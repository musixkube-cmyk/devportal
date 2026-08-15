import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

/**
 * POST /api/dashboard/keys/[id]/revoke
 * Marks the key as revoked (soft delete — kept for audit). The hashed_key
 * stays in the table so the gateway can still recognize attempts to use a
 * revoked key and reject them with a clear error.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // Make sure the key belongs to the caller
  const key = await db.apiKey.findFirst({
    where: { id, userId: user.id },
    select: { id: true, revokedAt: true, label: true },
  });
  if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (key.revokedAt) return NextResponse.json({ ok: true }); // idempotent

  await db.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await db.auditLog
    .create({
      data: {
        userId: user.id,
        action: "api_key.revoke",
        subject: { apiKeyId: id, label: key.label },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
