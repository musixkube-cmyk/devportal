// Quick verification — query api_key_events via the pg pool (works with
// Supabase's transaction-mode pooler, unlike Prisma's prepared statements).
//
// Run with: node --env-file=.env.local scripts/check-audit-events.mjs
import pgModule from "pg";
const { Pool } = pgModule.default || pgModule;

// Manual URL parsing — the password contains "!!" which breaks pg's parser
function parsePgUrl(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:]+):(\d+)\/(.+)$/);
  if (!m) throw new Error(`could not parse: ${url}`);
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: parseInt(m[4], 10),
    database: m[5],
  };
}

const url =
  process.env.SUPABASE_DB_POOLER_URL || process.env.DATABASE_URL;
if (!url || !url.startsWith("postgres")) {
  console.error("No postgres URL in env");
  process.exit(1);
}

const pool = new Pool(parsePgUrl(url));

const res = await pool.query(
  `SELECT method, path, status, "durationMs", "requestId", "createdAt"
   FROM api_key_events
   WHERE "apiKeyId" = $1
   ORDER BY "createdAt" DESC
   LIMIT 15`,
  ["a1b0037f-d910-49a5-9eba-ed692a0c070c"],
);

console.log(`Found ${res.rows.length} audit events:`);
for (const e of res.rows) {
  console.log(
    `  ${new Date(e.createdAt).toISOString()}  ${e.method.padEnd(6)} ${e.status}  ${String(e.durationMs).padStart(4)}ms  ${e.path}  (req=${e.requestId})`,
  );
}

await pool.end();
