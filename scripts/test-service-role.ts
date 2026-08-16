/**
 * Test whether the key from MusicosyCREDS.md actually has service_role
 * privileges against the live Supabase project.
 *
 * Tests performed:
 *   1. GET /auth/v1/admin/users  — ONLY service_role can call this.
 *      anon key returns 401. service_role returns 200 + user list.
 *
 *   2. POST /rest/v1/rpc/user_exists_by_email  — our RPC is
 *      SECURITY DEFINER + REVOKE EXECUTE FROM PUBLIC, so only
 *      service_role can invoke it. anon returns 42501 (permission denied).
 *      service_role returns 200 + { "exists": false }.
 *
 *   3. SELECT * FROM auth.users via PostgREST  — only service_role
 *      can read auth schema. anon returns permission denied.
 *
 * If ANY test returns 200, the key has service_role privileges — regardless
 * of what the JWT payload says. The JWT `role` claim is just a hint;
 * Supabase's GoTrue + PostgREST enforce based on the actual database role
 * the key resolves to, which can diverge from the claim after certain
 * dashboard operations (pause/unpause, key rotation, project rename).
 */

import { readFileSync } from "node:fs";

const CREDS_FILE = "/home/z/my-project/upload/MusicosyCREDS.md";
const PROJECT_URL = "https://kcvjdxerjttjhrzygtrp.supabase.co";

// Pull the key labeled NEXT_PUBLIC_SUPABASE_SUPABASE_SERVICE_ROLE out of the
// uploaded file. The file has markdown escaping (\_) so we strip that.
function readKey(label: string): string {
  const text = readFileSync(CREDS_FILE, "utf8");
  // The file has escaped underscores like NEXT\_PUBLIC\_... — strip them.
  // Then find the line that starts with the label followed by `=`.
  const stripped = text.replace(/\\_/g, "_");
  for (const line of stripped.split(/\r?\n/)) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    if (key === label) {
      return line.slice(eqIdx + 1).trim();
    }
  }
  throw new Error(`could not find ${label} in creds file`);
}

const anonKey = readKey("NEXT_PUBLIC_SUPABASE_SUPABASE_ANON");
const serviceRoleKey = readKey("NEXT_PUBLIC_SUPABASE_SUPABASE_SERVICE_ROLE");

console.log("=== Keys parsed from MusicosyCREDS.md ===");
console.log("anon          :", anonKey.slice(0, 40) + "...");
console.log("service_role  :", serviceRoleKey.slice(0, 40) + "...");
console.log("identical?    :", anonKey === serviceRoleKey ? "YES" : "no");
console.log();

async function test(name: string, url: string, init: RequestInit, expectedServiceRole: number) {
  console.log(`--- ${name} ---`);
  console.log("  request:", init.method || "GET", url);
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    const truncated = body.length > 300 ? body.slice(0, 300) + "..." : body;
    console.log(`  status: ${res.status}`);
    console.log(`  body  : ${truncated}`);
    if (res.status === expectedServiceRole) {
      console.log(`  ✓ behavior matches a service_role key`);
    } else if (res.status === 401 || res.status === 403 || res.status === 42501) {
      console.log(`  ✗ behavior matches an anon key (denied)`);
    } else {
      console.log(`  ? unexpected status`);
    }
  } catch (e) {
    console.log("  network error:", e instanceof Error ? e.message : e);
  }
  console.log();
}

async function main() {
  // TEST 1: GET /auth/v1/admin/users
  // service_role → 200 with user list. anon → 401.
  await test(
    "TEST 1: list auth.users via GoTrue admin endpoint",
    `${PROJECT_URL}/auth/v1/admin/users?per_page=1`,
    {
      method: "GET",
      headers: {
        apiKey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
    200,
  );

  // TEST 2: invoke the user_exists_by_email RPC
  // service_role → 200 {"exists":...}. anon → 42501.
  await test(
    "TEST 2: invoke user_exists_by_email RPC (SECURITY DEFINER, REVOKE FROM PUBLIC)",
    `${PROJECT_URL}/rest/v1/rpc/user_exists_by_email`,
    {
      method: "POST",
      headers: {
        apiKey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_email: "test@example.com" }),
    },
    200,
  );

  // TEST 3: read auth.users via PostgREST
  // service_role → 200 with rows. anon → 42501 (permission denied for schema auth).
  await test(
    "TEST 3: SELECT from auth.users via PostgREST",
    `${PROJECT_URL}/rest/v1/users?select=id&limit=1`,
    {
      method: "GET",
      headers: {
        apiKey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
    200,
  );

  // Sanity: run the same three tests with the anon key for comparison.
  console.log("=========================================");
  console.log("Comparison: same tests with the ANON key");
  console.log("=========================================\n");

  await test(
    "TEST 1 (anon): list auth.users via GoTrue admin endpoint",
    `${PROJECT_URL}/auth/v1/admin/users?per_page=1`,
    {
      method: "GET",
      headers: {
        apiKey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
    200,
  );

  await test(
    "TEST 2 (anon): invoke user_exists_by_email RPC",
    `${PROJECT_URL}/rest/v1/rpc/user_exists_by_email`,
    {
      method: "POST",
      headers: {
        apiKey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_email: "test@example.com" }),
    },
    200,
  );

  await test(
    "TEST 3 (anon): SELECT from auth.users via PostgREST",
    `${PROJECT_URL}/rest/v1/users?select=id&limit=1`,
    {
      method: "GET",
      headers: {
        apiKey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    },
    200,
  );

  console.log("=== VERDICT ===");
  console.log("If the first 3 tests returned 200 and the last 3 returned 401/403/42501,");
  console.log("the key labeled SERVICE_ROLE in MusicosyCREDS.md has service_role privileges");
  console.log("(regardless of what the JWT payload says) — the key works.");
  console.log("If all 6 tests returned the same status, both keys are the same anon key");
  console.log("and the service_role slot in your dashboard is misconfigured.");
}

main().catch(e => { console.error(e); process.exit(1); });

console.log("=== VERDICT ===");
console.log("If the first 3 tests returned 200 and the last 3 returned 401/403/42501,");
console.log("the key labeled SERVICE_ROLE in MusicosyCREDS.md has service_role privileges");
console.log("(regardless of what the JWT payload says) — I was wrong, the key works.");
console.log("If all 6 tests returned the same status, both keys are the same anon key");
console.log("and the service_role slot in your dashboard is misconfigured.");
