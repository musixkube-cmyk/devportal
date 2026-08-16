const { Client } = require('@supabase/supabase-js');
const supabase = Client ? null : null;
// Use pg directly
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.kcvjdxerjttjhrzygtrp:Bavin1863!!@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
  max: 1
});
(async () => {
  try {
    const r = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_type='BASE TABLE' 
      ORDER BY table_name;
    `);
    console.log('LIVE TABLES (' + r.rows.length + '):');
    r.rows.forEach(row => console.log('  ' + row.table_name));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    pool.end();
  }
})();
