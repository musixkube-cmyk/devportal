// Test the full sign-in flow end-to-end against the live Supabase + dev server
// to reproduce the "invalid credentials" issue the user is reporting.
import { createBrowserClient } from "@supabase/ssr";

const SUPA_URL = "https://kcvjdxerjttjhrzygtrp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8";
const APP_URL = "http://localhost:3000";

async function main() {
  const testEmail = `testuser_${Date.now()}@test.com`;
  const testPassword = "TestPassword123!";

  console.log(`\n=== Testing with NEW user: ${testEmail} ===`);

  // Step 1: Check email (should return exists:false)
  console.log("\n[1] POST /api/auth/check-email");
  const checkRes = await fetch(`${APP_URL}/api/auth/check-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });
  console.log(`  Status: ${checkRes.status}`);
  console.log(`  Body: ${await checkRes.text()}`);

  // Step 2: Sign up via /api/auth/signup
  console.log("\n[2] POST /api/auth/signup");
  const signupRes = await fetch(`${APP_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  console.log(`  Status: ${signupRes.status}`);
  console.log(`  Body: ${await signupRes.text()}`);

  // Step 3: Try signing in via Supabase SDK (this is what the frontend does)
  console.log("\n[3] supabase.auth.signInWithPassword (after signup)");
  const cookieJar = new Map<string, string>();
  const supabase = createBrowserClient(SUPA_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          if (value === "") cookieJar.delete(name);
          else cookieJar.set(name, value);
        }
      },
    },
  });
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
  if (signInError) {
    console.log(`  ERROR: ${signInError.message} (status: ${signInError.status})`);
  } else {
    console.log(`  SUCCESS: user.id=${signInData.user?.id}, has session=${!!signInData.session}`);
  }

  // Step 4: Check what's in auth.users for this email
  console.log("\n[4] Verify auth.users row was inserted correctly");
  const pg = (await import("pg")).default;
  const client = new pg.Client({
    connectionString:
      "postgresql://postgres.kcvjdxerjttjhrzygtrp:Bavin1863!!@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
  });
  await client.connect();
  const r = await client.query(
    `SELECT id, email, encrypted_password IS NOT NULL AS has_pw, email_confirmed_at IS NOT NULL AS confirmed, last_sign_in_at
     FROM auth.users WHERE email = $1`,
    [testEmail],
  );
  console.log("  Row:", JSON.stringify(r.rows[0], null, 2));

  // Step 5: Try login via Supabase REST directly (bypassing our SDK setup)
  console.log("\n[5] Direct REST login (Supabase GoTrue)");
  const restRes = await fetch(
    `${SUPA_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    },
  );
  console.log(`  Status: ${restRes.status}`);
  const restBody = await restRes.text();
  console.log(`  Body: ${restBody.slice(0, 300)}`);

  // Step 6: Now test admin@musicosy.com (existing user) to compare
  console.log(`\n=== Testing with EXISTING user: admin@musicosy.com ===`);

  console.log("\n[6] Direct REST login for admin@musicosy.com");
  const restRes2 = await fetch(
    `${SUPA_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "admin@musicosy.com",
        password: "Musicosy2026!",
      }),
    },
  );
  console.log(`  Status: ${restRes2.status}`);
  const restBody2 = await restRes2.text();
  console.log(`  Body: ${restBody2.slice(0, 300)}`);

  // Step 7: Look at the existing admin row
  console.log("\n[7] admin@musicosy.com auth.users row");
  const r2 = await client.query(
    `SELECT id, email, encrypted_password IS NOT NULL AS has_pw, 
            LENGTH(encrypted_password) AS pw_len,
            email_confirmed_at IS NOT NULL AS confirmed, 
            last_sign_in_at,
            LEFT(encrypted_password, 7) AS pw_prefix
     FROM auth.users WHERE email = $1`,
    ["admin@musicosy.com"],
  );
  console.log("  Row:", JSON.stringify(r2.rows[0], null, 2));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
