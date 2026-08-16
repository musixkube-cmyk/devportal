import { Pool } from "pg";

// Hardcode the pooler URL because a stray .env file is shadowing .env.local
// with a file: SQLite URL — see src/lib/pg.ts for the same workaround.
const dbUrl = "postgresql://postgres.kcvjdxerjttjhrzygtrp:Bavin1863!!@aws-0-us-east-2.pooler.supabase.com:6543/postgres";
const m = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!m) { console.error("bad url"); process.exit(1); }
const [, user, password, host, portStr, database] = m;
const pool = new Pool({ host, port: Number(portStr), user, password, database, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  // What tables exist in public schema right now?
  const r1 = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log("=== TABLES IN public schema ===");
  for (const row of r1.rows) console.log("  " + row.table_name);

  // Columns on api_keys (to verify camelCase vs snake_case)
  const r2 = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys'
    ORDER BY ordinal_position;
  `);
  console.log("\n=== COLUMNS on public.api_keys ===");
  for (const row of r2.rows) console.log(`  ${row.column_name}  (${row.data_type})`);

  // Columns on webhooks
  const r3 = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'webhooks'
    ORDER BY ordinal_position;
  `);
  console.log("\n=== COLUMNS on public.webhooks ===");
  for (const row of r3.rows) console.log("  " + row.column_name);

  // Does the user_exists_by_email function exist?
  const r4 = await pool.query(`
    SELECT routine_name, security_type
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name LIKE '%user_exists%';
  `);
  console.log("\n=== RPCs in public schema ===");
  for (const row of r4.rows) console.log(`  ${row.routine_name}  (security: ${row.security_type})`);

  // Does audit_logs exist?
  const r5 = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
    ORDER BY ordinal_position;
  `);
  console.log("\n=== COLUMNS on public.audit_logs ===");
  if (r5.rows.length === 0) console.log("  (table does not exist)");
  for (const row of r5.rows) console.log("  " + row.column_name);

  // RLS status
  const r6 = await pool.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true
    ORDER BY tablename;
  `);
  console.log("\n=== Tables with RLS ENABLED ===");
  for (const row of r6.rows) console.log("  " + row.tablename);

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
