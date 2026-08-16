// Run the full schema migration against the live Supabase DB.
// Reads the SQL file, sends it through the pg pooler in one batch.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SQL_PATH = path.join(__dirname, 'full-schema-migration.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');

// Use the SESSION-MODE pooler (port 5432, IPv4). The direct DB hostname
// (db.<project>.supabase.co) resolves to IPv6 which the sandbox can't route.
// The pooler hostname (aws-0-us-east-2.pooler.supabase.com) is IPv4.
// Session mode is required for multi-statement DDL (no prepared-statement limit).
const pool = new Pool({
  connectionString: 'postgresql://postgres.kcvjdxerjttjhrzygtrp:Bavin1863!!@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
  max: 1,
  connectionTimeoutMillis: 30000,
  query_timeout: 180000,
});

(async () => {
  const start = Date.now();
  console.log(`[migrate] running ${SQL_PATH} (${(sql.length / 1024).toFixed(1)} KB)`);
  try {
    // Use the simple query protocol so multi-statement SQL works.
    // pg's parameterized path only allows one statement per call.
    const result = await pool.query(sql);
    console.log(`[migrate] OK in ${Date.now() - start}ms`);

    // Verify: list table count
    const cnt = await pool.query(`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE';
    `);
    console.log(`[migrate] live tables: ${cnt.rows[0].n}`);

    const enums = await pool.query(`
      SELECT count(*)::int AS n FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname='public' AND t.typtype='e';
    `);
    console.log(`[migrate] live enums: ${enums.rows[0].n}`);

    const funcs = await pool.query(`
      SELECT count(*)::int AS n FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public';
    `);
    console.log(`[migrate] live functions: ${funcs.rows[0].n}`);
  } catch (e) {
    console.error(`[migrate] FAILED after ${Date.now() - start}ms`);
    console.error(e.message);
    if (e.position) {
      const pos = parseInt(e.position, 10);
      console.error(`[migrate] error at SQL char offset ${pos}:`);
      console.error('---context---');
      console.error(sql.substring(Math.max(0, pos - 200), pos + 200));
      console.error('---end context---');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
