import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-keys";

/**
 * POST /api/dashboard/keys/[id]/roll
 *
 * Generates a new secret for an existing key, updates the row with the new
 * hash + prefix + lastFour, and returns the new raw secret. The old secret
 * stops working immediately.
 *
 * Use case: key compromise, rotation policy, or user lost the secret string.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const key = await db.apiKey.findFirst({
    where: { id, userId: user.id },
    select: { id: true, label: true, revokedAt: true },
  });
  if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (key.revokedAt) {
    return NextResponse.json({ error: "cannot roll a revoked key" }, { status: 400 });
  }

  const { rawSecret, hashedKey, prefix, lastFour } = generateApiKey();

  await db.apiKey.update({
    where: { id },
    data: { hashedKey, prefix, lastFour },
  });

  await db.auditLog
    .create({
      data: {
        userId: user.id,
        action: "api_key.roll",
        subject: { apiKeyId: id, label: key.label },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ id, label: key.label, rawSecret });
}
