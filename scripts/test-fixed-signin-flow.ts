// End-to-end test simulating the actual browser flow after the form fix.
// Uses the real @supabase/ssr browser client with cookie capture, hits the
// real /api/auth/* routes, retries signin like the new form does, then
// verifies the session cookie actually authenticates /dashboard/keys.

import { createBrowserClient } from "@supabase/ssr";

const SUPA_URL = "https://kcvjdxerjttjhrzygtrp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8";
const APP_URL = "http://localhost:3000";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signInWithRetry(
  supabase: ReturnType<typeof createBrowserClient>,
  emailVal: string,
  passwordVal: string,
  retries = 3,
  delayMs = 600,
): Promise<{ ok: boolean; error?: string }> {
  let { error: signInError } = await supabase.auth.signInWithPassword({
    email: emailVal,
    password: passwordVal,
  });
  if (!signInError) return { ok: true };

  for (let i = 0; i < retries; i++) {
    await wait(delayMs);
    const { error: retryError } = await supabase.auth.signInWithPassword({
      email: emailVal,
      password: passwordVal,
    });
    if (!retryError) return { ok: true };
    signInError = retryError;
  }
  return { ok: false, error: signInError?.message };
}

async function testFlow(label: string, email: string, password: string, expectExists: boolean) {
  console.log(`\n========== ${label} ==========`);
  console.log(`Email: ${email}`);

  // Step 1: check-email
  console.log("\n[1] POST /api/auth/check-email");
  const checkRes = await fetch(`${APP_URL}/api/auth/check-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const checkBody = await checkRes.json();
  console.log(`  Status: ${checkRes.status}, exists=${checkBody.exists}`);
  if (checkBody.exists !== expectExists) {
    console.log(`  !! Expected exists=${expectExists}, got ${checkBody.exists}`);
  }

  // Set up browser client with cookie capture
  const cookieJar = new Map<string, string>();
  const supabase = createBrowserClient(SUPA_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          if (value === "") cookieJar.delete(name);
          else cookieJar.set(name, value);
        }
      },
    },
  });

  if (!expectExists) {
    // Step 2a: signup
    console.log("\n[2a] POST /api/auth/signup (new user)");
    const signupRes = await fetch(`${APP_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    console.log(`  Status: ${signupRes.status}, body=${await signupRes.text()}`);

    // Step 2b: signin with retry (like the fixed form does)
    console.log("\n[2b] signInWithPassword (with retry, like the fixed form)");
    const t0 = Date.now();
    const result = await signInWithRetry(supabase, email, password, 3, 600);
    console.log(`  Result: ${result.ok ? "SUCCESS" : "FAILED"} in ${Date.now() - t0}ms${result.error ? " — " + result.error : ""}`);
  } else {
    // Existing user: just signin
    console.log("\n[2] signInWithPassword (existing user, with retry)");
    const t0 = Date.now();
    const result = await signInWithRetry(supabase, email, password, 3, 600);
    console.log(`  Result: ${result.ok ? "SUCCESS" : "FAILED"} in ${Date.now() - t0}ms${result.error ? " — " + result.error : ""}`);
  }

  // Step 3: verify the session cookie authenticates /dashboard/keys
  console.log("\n[3] Verify session works on /api/dashboard/keys");
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const dashRes = await fetch(`${APP_URL}/api/dashboard/keys`, {
    headers: { Cookie: cookieHeader },
  });
  console.log(`  Status: ${dashRes.status}`);
  if (dashRes.status === 200) {
    const body = await dashRes.json();
    console.log(`  Keys returned: ${body.keys?.length ?? 0}`);
  } else {
    console.log(`  Body: ${(await dashRes.text()).slice(0, 200)}`);
  }

  // Step 4: verify middleware accepts the session on /dashboard
  console.log("\n[4] Verify middleware accepts session on /dashboard");
  const pageRes = await fetch(`${APP_URL}/dashboard`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  console.log(`  Status: ${pageRes.status}, location=${pageRes.headers.get("location") ?? "(none)"}`);
}

async function main() {
  // Test 1: existing admin user (the one the user said gives "invalid credentials")
  await testFlow(
    "EXISTING USER: admin@musicosy.com",
    "admin@musicosy.com",
    "Musicosy2026!",
    true,
  );

  // Test 2: brand-new user (the one the user said prompts password twice + no redirect)
  const newEmail = `onboard_test_${Date.now()}@test.com`;
  await testFlow(
    "NEW USER: " + newEmail,
    newEmail,
    "OnboardTest123!",
    false,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
