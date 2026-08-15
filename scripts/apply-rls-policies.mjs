// One-off script: applies RLS policies to api_keys, webhooks, audit_logs.
// Idempotent — uses DROP POLICY IF EXISTS before CREATE.
//
// Run with: node scripts/apply-rls-policies.mjs

import fs from "node:fs";

// --- Load env from .env.local / .env ---
const envMap = {};
for (const f of [".env", ".env.local"]) {
  try {
    const txt = fs.readFileSync(f, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      envMap[m[1]] = v;
    }
  } catch {}
}

const dbUrl = envMap.SUPABASE_DB_POOLER_URL || envMap.DATABASE_URL;
if (!dbUrl) {
  console.error("✗ Missing DATABASE_URL or SUPABASE_DB_POOLER_URL");
  process.exit(1);
}

const m = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!m) {
  console.error("✗ Could not parse DATABASE_URL");
  process.exit(1);
}
const [, user, password, host, portStr, database] = m;

const { default: pgModule } = await import("pg");
const Pool = pgModule.Pool || pgModule.default?.Pool || pgModule;
const pool = new Pool({
  host,
  port: Number(portStr),
  user,
  password,
  database,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const sql = fs.readFileSync(
  new URL("../supabase/migrations/20260816000000_rls_policies.sql", import.meta.url),
  "utf8",
);

// Split on semicolons, but only at end-of-statement (not inside function bodies).
// Our migration has no functions, so a simple split works.
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

try {
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log(`✓ Applied ${statements.length} RLS statements`);
  console.log("  - api_keys: RLS enabled, SELECT/INSERT/UPDATE policies for owner");
  console.log("  - webhooks: RLS enabled, SELECT/INSERT/UPDATE/DELETE policies for owner");
  console.log("  - audit_logs: RLS enabled, SELECT-only for owner (writes via service_role)");
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
