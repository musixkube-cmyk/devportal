const { Pool } = require('pg');
const pool = new Pool({
  host: 'aws-0-us-east-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.kcvjdxerjttjhrzygtrp',
  password: 'Bavin1863!!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});
(async () => {
  try {
    const r1 = await pool.query("SELECT id, email, role, verified, created_at FROM public.users WHERE email = 'admin@musicosy.com'");
    console.log('public.users admin row:', r1.rows);
    const r2 = await pool.query("SELECT count(*) as cnt FROM auth.users");
    console.log('auth.users total count:', r2.rows[0].cnt);
    const r3 = await pool.query("SELECT id, email, role, created_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC LIMIT 10");
    console.log('recent auth.users:', r3.rows);
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
})();
