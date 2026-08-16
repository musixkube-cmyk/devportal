// Quick introspection: what tables/columns are actually in the live DB right now?
// Run: npx tsx scripts/check-live-db.ts
import { Pool } from 'pg';

const url = process.env.DATABASE_URL!;
console.log("Connecting to:", url.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({ connectionString: url, max: 1 });

async function main() {
  const client = await pool.connect();
  try {
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log(`\n=== LIVE DB TABLES (${tables.rows.length}) ===`);
    for (const r of tables.rows) console.log(`  - ${r.table_name}`);

    // For the 7 conflict-candidate tables, show columns
    const focus = ['api_keys', 'api_key_events', 'usage_daily', 'webhooks', 'webhook_deliveries', 'audit_logs', 'developer_profiles'];
    for (const t of focus) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      if (cols.rows.length === 0) { console.log(`\n(table ${t} does NOT exist in live DB)`); continue; }
      console.log(`\n=== ${t} columns ===`);
      for (const c of cols.rows) console.log(`  ${c.column_name}  ${c.data_type}  ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }

    // Row counts
    console.log("\n=== ROW COUNTS (conflict tables) ===");
    for (const t of focus) {
      try {
        const r = await client.query(`SELECT count(*)::int AS n FROM public.${t}`);
        console.log(`  ${t}: ${r.rows[0].n} rows`);
      } catch (e: any) {
        console.log(`  ${t}: (table missing)`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
