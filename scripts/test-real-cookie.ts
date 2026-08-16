// Test by using the actual @supabase/ssr library to write the cookie,
// simulating what the browser would do.
import { createBrowserClient } from "@supabase/ssr";

const SUPA_URL = "https://kcvjdxerjttjhrzygtrp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8";
const APP_URL = "http://localhost:3000";

async function main() {
  // Capture cookies using the getAll/setAll API
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
          if (value === "") {
            cookieJar.delete(name);
          } else {
            cookieJar.set(name, value);
          }
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@musicosy.com",
    password: "Musicosy2026!",
  });

  if (error) {
    console.log("Sign-in error:", error);
    process.exit(1);
  }

  console.log("Signed in. user.id:", data.user?.id);
  console.log("Cookies set:");
  for (const [k, v] of cookieJar.entries()) {
    console.log(
      `  ${k} = ${v.slice(0, 100)}${v.length > 100 ? "..." : ""} (len=${v.length})`,
    );
  }

  // Now use those cookies to hit /dashboard/keys
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  console.log("\n=== GET /dashboard/keys with real cookies ===");
  const r = await fetch(`${APP_URL}/dashboard/keys`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  console.log(`Status: ${r.status}`);
  console.log(`Location: ${r.headers.get("location") ?? "(none)"}`);
  if (r.status === 200) {
    const text = await r.text();
    const hasMasterKey = text.includes("Master Key");
    const hasSkLive = text.includes("sk_live_");
    const hasNoKeys = text.includes("No API keys yet");
    const hasError = text.includes("Failed to load");
    console.log(`Page contains "Master Key": ${hasMasterKey}`);
    console.log(`Page contains "sk_live_": ${hasSkLive}`);
    console.log(`Page contains "No API keys yet": ${hasNoKeys}`);
    console.log(`Page contains error: ${hasError}`);
    console.log(`Body length: ${text.length}`);
  }

  console.log("\n=== GET /api/dashboard/keys with real cookies ===");
  const r2 = await fetch(`${APP_URL}/api/dashboard/keys`, {
    headers: { Cookie: cookieHeader },
  });
  console.log(`Status: ${r2.status}`);
  console.log(`Body: ${(await r2.text()).slice(0, 400)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
