// Test whether the IM proxy at preview-chat-*.space-z.ai forwards cookies
// to localhost:3000. If it doesn't, that's the root cause of the auth
// redirect loop — middleware on localhost:3000 never sees the session
// cookie even though the browser set it correctly.

import { createBrowserClient } from "@supabase/ssr";

const SUPA_URL = "https://kcvjdxerjttjhrzygtrp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8";

const PREVIEW_URL =
  "https://preview-chat-fb9add05-dad6-40f3-98dd-e51874b39be9.space-z.ai";
const LOCAL_URL = "http://localhost:3000";

async function main() {
  console.log("=== Step 1: Sign in to Supabase to get a real session ===");
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@musicosy.com",
    password: "Musicosy2026!",
  });
  if (error) {
    console.log("Sign-in error:", error);
    process.exit(1);
  }
  console.log(`Signed in. user.id=${data.user?.id}`);
  console.log(`Cookies in jar: ${cookieJar.size}`);
  for (const [k, v] of cookieJar.entries()) {
    console.log(`  ${k} (len=${v.length})`);
  }

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  console.log("\n=== Step 2: Hit LOCAL /api/auth/debug-cookies (bypass IM proxy) ===");
  const localRes = await fetch(`${LOCAL_URL}/api/auth/debug-cookies`, {
    headers: { Cookie: cookieHeader },
  });
  const localBody = await localRes.json();
  console.log(`Status: ${localRes.status}`);
  console.log(`cookieCount: ${localBody.cookieCount}`);
  console.log(`cookies: ${JSON.stringify(localBody.cookies?.map((c: any) => c.name))}`);
  console.log(`headers.host: ${localBody.headers?.host}`);

  console.log("\n=== Step 3: Hit PREVIEW /api/auth/debug-cookies (through IM proxy) ===");
  console.log(`Sending Cookie header (len=${cookieHeader.length})`);
  const previewRes = await fetch(`${PREVIEW_URL}/api/auth/debug-cookies`, {
    headers: {
      Cookie: cookieHeader,
      Origin: PREVIEW_URL,
      Referer: `${PREVIEW_URL}/`,
    },
  });
  const previewBody = await previewRes.json();
  console.log(`Status: ${previewRes.status}`);
  console.log(`cookieCount: ${previewBody.cookieCount}`);
  console.log(`cookies: ${JSON.stringify(previewBody.cookies?.map((c: any) => c.name))}`);
  console.log(`headers.host: ${previewBody.headers?.host}`);
  console.log(`headers.origin: ${previewBody.headers?.origin}`);
  console.log(`headers.referer: ${previewBody.headers?.referer}`);
  console.log(`headers.x-forwarded-for: ${previewBody.headers?.["x-forwarded-for"]}`);
  console.log(`url: ${previewBody.url}`);

  console.log("\n=== Step 4: Hit PREVIEW /dashboard/keys (through IM proxy) ===");
  const dashRes = await fetch(`${PREVIEW_URL}/dashboard/keys`, {
    headers: {
      Cookie: cookieHeader,
      Origin: PREVIEW_URL,
      Referer: `${PREVIEW_URL}/`,
    },
    redirect: "manual",
  });
  console.log(`Status: ${dashRes.status}`);
  console.log(`Location: ${dashRes.headers.get("location") ?? "(none)"}`);

  console.log("\n=== Step 5: Hit PREVIEW /api/dashboard/keys (through IM proxy) ===");
  const keysRes = await fetch(`${PREVIEW_URL}/api/dashboard/keys`, {
    headers: {
      Cookie: cookieHeader,
      Origin: PREVIEW_URL,
      Referer: `${PREVIEW_URL}/`,
    },
  });
  console.log(`Status: ${keysRes.status}`);
  const keysBody = await keysRes.text();
  console.log(`Body: ${keysBody.slice(0, 200)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
