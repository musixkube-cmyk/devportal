// One-off script: creates the user_exists_by_email(p_email text) Postgres
// function in the linked Supabase project. Idempotent — uses CREATE OR REPLACE.
//
// Run with: node scripts/apply-user-exists-function.mjs
//
// Uses the `pg` library directly via the Supabase pooler URL. We split
// CREATE OR REPLACE FUNCTION and REVOKE into two separate calls because
// Postgres prepared statements can't run multiple commands in one go.

import fs from "node:fs";

// --- Load env from .env.local / .env (node doesn't auto-load) ---
// .env.local wins over .env wins over process.env
const envMap = {};
for (const f of [".env", ".env.local"]) {
  try {
    const txt = fs.readFileSync(f, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      envMap[key] = val;
    }
  } catch {
    // file doesn't exist — skip
  }
}

const dbUrl = envMap.DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("✗ Missing DATABASE_URL");
  process.exit(1);
}

// The password contains "!!" which can break URL parsing. Parse manually.
const m = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
if (!m) {
  console.error("✗ Could not parse DATABASE_URL:", dbUrl.slice(0, 40) + "...");
  process.exit(1);
}
const [, user, password, host, portStr, dbAndParams] = m;
const database = dbAndParams.split("?")[0];

const { default: pgModule } = await import("pg");
const Pool = pgModule.Pool || pgModule.default?.Pool || pgModule;

const pool = new Pool({
  host,
  port: Number(portStr),
  user,
  password,
  database,
  ssl: { rejectUnauthorized: false },
});

const createSql = `
CREATE OR REPLACE FUNCTION public.user_exists_by_email(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = lower(p_email));
$$;
`;

const revokeSql = `
REVOKE EXECUTE ON FUNCTION public.user_exists_by_email(text) FROM PUBLIC;
`;

try {
  await pool.query(createSql);
  console.log("✓ Function public.user_exists_by_email(text) created");
  await pool.query(revokeSql);
  console.log("✓ Revoked execute from PUBLIC (service_role still has access)");
} catch (err) {
  console.error("✗ Failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
