import pg from "pg";

const url =
  "postgresql://postgres.kcvjdxerjttjhrzygtrp:Bavin1863!!@aws-0-us-east-2.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log("=== api_keys rows ===");
  const r = await client.query(`
    SELECT id, user_id, organization_id, name, label, prefix, last_four, revoked, scopes, created_at
    FROM api_keys
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log(JSON.stringify(r.rows, null, 2));

  console.log("\n=== auth.users for admin@musicosy.com ===");
  const u = await client.query(`
    SELECT id, email FROM auth.users WHERE email = 'admin@musicosy.com'
  `);
  console.log(JSON.stringify(u.rows, null, 2));

  console.log("\n=== public.users for admin@musicosy.com ===");
  const p = await client.query(`
    SELECT id, email FROM public.users WHERE email = 'admin@musicosy.com'
  `);
  console.log(JSON.stringify(p.rows, null, 2));

  console.log("\n=== RLS policies on api_keys ===");
  const pol = await client.query(`
    SELECT polname, polcmd, polqual, polwithcheck
    FROM pg_policy
    JOIN pg_class ON pg_policy.polrelid = pg_class.oid
    WHERE relname = 'api_keys'
  `);
  console.log(JSON.stringify(pol.rows, null, 2));

  console.log("\n=== Is RLS enabled on api_keys? ===");
  const rls = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = 'api_keys'
  `);
  console.log(JSON.stringify(rls.rows, null, 2));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
