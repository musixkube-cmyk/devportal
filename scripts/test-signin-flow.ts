// Simulate the full sign-in flow:
// 1. POST to supabase auth/v1/token to get access_token
// 2. Build the sb-<ref>-auth-token cookie that @supabase/ssr would set
// 3. Hit /api/dashboard/keys with that cookie
// 4. See what comes back
const SUPA_URL = "https://kcvjdxerjttjhrzygtrp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8";
const REF = "kcvjdxerjttjhrzygtrp";
const APP_URL = "http://localhost:3000";

async function main() {
  // 1. Get tokens
  const tokenRes = await fetch(
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
  const tok = await tokenRes.json();
  if (!tok.access_token) {
    console.log("LOGIN FAILED:", tok);
    process.exit(1);
  }
  console.log("Got access_token, expires_in:", tok.expires_in);

  // 2. Build the cookie value that @supabase/ssr sets.
  // The @supabase/ssr library stores the session as a JSON-stringified object
  // containing {access_token, refresh_token, expires_in, expires_at, token_type, user}
  // Base64-encoded, in a cookie named `sb-<ref>-auth-token`.
  // However, the modern @supabase/ssr (v0.5.0+) uses base64-encoded JSON.
  // Let's try both formats:
  const session = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_in: tok.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + tok.expires_in,
    token_type: tok.token_type || "bearer",
    user: tok.user,
  };

  // Try raw JSON first (older @supabase/ssr versions)
  const cookieRaw = JSON.stringify(session);
  // base64url with the "base64-" prefix (this is what @supabase/ssr v0.12+ writes)
  const cookieB64url =
    "base64-" +
    Buffer.from(cookieRaw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  // 3. Try both cookies against /api/me
  for (const [label, val] of [
    ["raw-JSON", cookieRaw],
    ["base64url", cookieB64url],
  ]) {
    const cookieName = `sb-${REF}-auth-token`;
    const r = await fetch(`${APP_URL}/api/me`, {
      headers: { Cookie: `${cookieName}=${encodeURIComponent(val)}` },
    });
    console.log(
      `[${label}] GET /api/me -> ${r.status}: ${await r.text()}`,
    );
  }

  // 4. Now try the actual dashboard/keys endpoint
  for (const [label, val] of [
    ["raw-JSON", cookieRaw],
    ["base64url", cookieB64url],
  ]) {
    const cookieName = `sb-${REF}-auth-token`;
    const r = await fetch(`${APP_URL}/api/dashboard/keys`, {
      headers: { Cookie: `${cookieName}=${encodeURIComponent(val)}` },
    });
    console.log(
      `[${label}] GET /api/dashboard/keys -> ${r.status}: ${await r.text()}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
