import { Pool } from "pg";

/**
 * Direct PostgreSQL connection pool — bypasses Prisma entirely.
 *
 * Used for operations that Prisma can't express cleanly:
 *   - INSERT into auth.users with crypt() for password hashing
 *   - DDL operations (CREATE FUNCTION, etc.)
 *
 * Connection details come from DATABASE_URL. The URL parsing is manual
 * because the password contains "!!" which can confuse URL parsers.
 */

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

  // Try several env var names — Next.js sometimes loads from a nested .env
  // that overrides the project root .env.local. Prefer the explicit Supabase
  // pooler URL if available, fall back to DATABASE_URL.
  let dbUrl =
    process.env.SUPABASE_DB_POOLER_URL ||
    process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  // Strip surrounding quotes if present (Next.js usually does this, but
  // some env-loading paths don't)
  if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
    dbUrl = dbUrl.slice(1, -1);
  }

  // If it's not a postgres URL (e.g. file:... from a stray .env), bail out
  // with a clear message.
  if (!dbUrl.startsWith("postgres")) {
    throw new Error(
      `DATABASE_URL is not a postgres URL: ${dbUrl.slice(0, 50)}. ` +
      `Set SUPABASE_DB_POOLER_URL in .env.local to override.`,
    );
  }

  // Manual parse — pg's URL parser mishandles the "!!" in the password
  const m = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) {
    throw new Error(`Could not parse DATABASE_URL: ${dbUrl.slice(0, 30)}...`);
  }
  const [, user, password, host, portStr, database] = m;

  _pool = new Pool({
    host,
    port: Number(portStr),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    // Supabase pooler limits — stay below their per-project cap
    max: 5,
    idleTimeoutMillis: 30_000,
  });

  return _pool;
}

export const pgPool = {
  query: <T = unknown>(text: string, params?: unknown[]) => getPool().query<T>(text, params),
  end: () => _pool?.end(),
};
