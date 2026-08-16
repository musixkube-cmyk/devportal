import { createHash, randomBytes } from "node:crypto";

/**
 * Musicosy API key generation + hashing utilities.
 *
 * Format of the raw secret shown to the user:
 *   sk_live_<43 chars of url-safe base64>
 *
 * The full secret is 51 chars including the `sk_live_` prefix. The prefix is
 * fixed; only the 43-char tail is the secret.
 *
 * Storage:
 *   - `hashedKey` (sha-256 hex of the FULL secret including prefix) — used for
 *     lookup at request time. Indexed + unique.
 *   - `prefix` (first 8 chars of the secret tail) — shown in the UI so the
 *     user can identify which key it is.
 *   - `lastFour` (last 4 chars of the secret tail) — shown alongside prefix
 *     so the user can confirm "this is the one".
 *
 * We never store the raw secret. If lost, the user must roll the key.
 */

const PREFIX = "sk_live_";
const SECRET_BYTES = 32; // 32 bytes → 43 chars url-safe base64

export function generateApiKey() {
  const random = randomBytes(SECRET_BYTES);
  const tail = random.toString("base64url"); // 43 chars
  const rawSecret = `${PREFIX}${tail}`;
  return {
    rawSecret,
    hashedKey: hashApiKey(rawSecret),
    prefix: tail.slice(0, 8),
    lastFour: tail.slice(-4),
  };
}

export function hashApiKey(rawSecret: string): string {
  return createHash("sha256").update(rawSecret).digest("hex");
}

/**
 * Looks up an API key by hashing the incoming secret and matching against
 * `hashedKey`. Returns the key row (without the hash) or null.
 *
 * Uses the direct pg pool instead of Prisma to avoid the "prepared statement
 * already exists" error that occurs with Supabase's transaction-mode pooler.
 */
export async function findApiKeyByRawSecret(rawSecret: string) {
  const { pgPool } = await import("@/lib/pg");
  const hashedKey = hashApiKey(rawSecret);
  const result = await pgPool.query<{
    id: string;
    user_id: string;
    label: string;
    scopes: string;
    revoked_at: Date | null;
    expires_at: Date | null;
  }>(
    `SELECT id, "userId" AS user_id, label, scopes,
            "revokedAt" AS revoked_at, "expiresAt" AS expires_at
     FROM api_keys
     WHERE "hashedKey" = $1
     LIMIT 1`,
    [hashedKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && row.expires_at.getTime() < Date.now()) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    scopes: row.scopes,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
  };
}
