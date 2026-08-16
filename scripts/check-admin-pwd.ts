// Check what admin@musicosy.com's password hash looks like in auth.users.
// GoTrue expects bcrypt with $2a$ / $2b$ / $2y$ prefix. pgcrypto's crypt()
// with gen_salt('bf') produces $2a$ — that SHOULD be compatible.
// But maybe the admin user was created differently, or the hash is malformed.

import { pgPool } from "../src/lib/pg";

async function main() {
  const email = process.argv[2] || "admin@musicosy.com";

  // 1. Look at the user row
  const { rows } = await pgPool.query(
    `SELECT id, email, 
            LEFT(encrypted_password, 4) AS hash_prefix,
            LENGTH(encrypted_password) AS hash_len,
            email_confirmed_at,
            created_at,
            LENGTH(COALESCE(encrypted_password, '')) > 0 AS has_password
     FROM auth.users 
     WHERE email = $1`,
    [email.toLowerCase()],
  );

  if (rows.length === 0) {
    console.log(`NO USER FOUND with email ${email}`);
    console.log("---");
    console.log("All users in auth.users:");
    const { rows: all } = await pgPool.query(
      `SELECT email, LEFT(encrypted_password, 4) AS prefix, LENGTH(encrypted_password) AS len FROM auth.users ORDER BY created_at DESC LIMIT 10`,
    );
    for (const r of all) console.log(`  ${r.email}  prefix=${r.prefix}  len=${r.len}`);
    process.exit(0);
  }

  const u = rows[0];
  console.log(`User: ${email}`);
  console.log(`  id: ${u.id}`);
  console.log(`  hash_prefix: ${u.hash_prefix}  (expect $2a$ / $2b$ / $2y$ for bcrypt)`);
  console.log(`  hash_len: ${u.hash_len}  (bcrypt is ~60 chars)`);
  console.log(`  has_password: ${u.has_password}`);
  console.log(`  email_confirmed_at: ${u.email_confirmed_at}`);
  console.log(`  created_at: ${u.created_at}`);

  // 2. Test the password directly against the hash in DB
  const testPwd = process.argv[3] || "Musicosy2026!";
  const { rows: verifyRows } = await pgPool.query(
    `SELECT encrypted_password = crypt($2, encrypted_password) AS matches
     FROM auth.users WHERE email = $1`,
    [email.toLowerCase(), testPwd],
  );
  console.log(`---`);
  console.log(`Password verification (pgcrypto crypt() check):`);
  console.log(`  password "${testPwd}" matches hash: ${verifyRows[0]?.matches}`);

  // 3. Also test what our signup route WOULD produce for this password
  const { rows: sampleRows } = await pgPool.query(
    `SELECT crypt($1, gen_salt('bf')) AS new_hash`,
    [testPwd],
  );
  console.log(`---`);
  console.log(`What signup route would produce for "${testPwd}":`);
  console.log(`  hash: ${sampleRows[0]?.new_hash}`);
  console.log(`  length: ${sampleRows[0]?.new_hash.length}`);

  // 4. Does GoTrue's verify accept that hash? (i.e., is it valid bcrypt)
  const { rows: verifyNew } = await pgPool.query(
    `SELECT $1 = crypt($2, $1) AS self_verifies`,
    [sampleRows[0]?.new_hash, testPwd],
  );
  console.log(`  new hash self-verifies: ${verifyNew[0]?.self_verifies}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
