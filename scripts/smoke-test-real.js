// Smoke-test the gateway with the real seeded API key.
// Uses ACTUAL endpoint paths from src/data/api-reference.json (174 GET endpoints).

const API_KEY = process.argv[2] || "sk_live_2B4t_sgaT9CgJBjSnA2NGw5Hel5IvjZSAIkrb-q4A6U";
const BASE = "http://localhost:3000";

const api = require("../src/data/api-reference.json");

// Collect all GET endpoints, replace {param} placeholders with the seeded UUIDs.
const SEED_ID = "00000000-0000-0000-0000-000000000002";  // user
const SEED_RELEASE = "a0000000-0000-0000-0000-000000000001";  // release
const SEED_POST = "a0000000-0000-0000-0000-000000000003";  // post
const SEED_STREAM = "00000000-0000-0000-0000-000000000002";  // fallback

const endpoints = [];
for (const d of api.domains) {
  for (const r of d.resources) {
    for (const e of r.endpoints) {
      if (e.method !== "GET") continue;
      let path = e.path;
      path = path.replace(/\{id\}/g, SEED_ID);
      path = path.replace(/\{profileId\}/g, SEED_ID);
      path = path.replace(/\{userId\}/g, SEED_ID);
      path = path.replace(/\{contentId\}/g, SEED_RELEASE);
      path = path.replace(/\{assetId\}/g, SEED_RELEASE);
      path = path.replace(/\{releaseId\}/g, SEED_RELEASE);
      path = path.replace(/\{postId\}/g, SEED_POST);
      path = path.replace(/\{streamId\}/g, SEED_STREAM);
      path = path.replace(/\{episodeId\}/g, SEED_ID);
      path = path.replace(/\{showId\}/g, SEED_ID);
      path = path.replace(/\{tourId\}/g, SEED_ID);
      path = path.replace(/\{contractId\}/g, SEED_ID);
      path = path.replace(/\{campaignId\}/g, SEED_ID);
      path = path.replace(/\{orgId\}/g, "00000000-0000-0000-0000-000000000001");
      endpoints.push(path);
    }
  }
}

(async () => {
  let pass = 0, fail = 0;
  const failures = [];
  const passes = [];

  console.log(`[smoke] testing ${endpoints.length} GET endpoints with API key ${API_KEY.slice(0, 12)}...`);
  console.log("---");

  for (const path of endpoints) {
    try {
      const res = await fetch(`${BASE}/api${path}`, {
        headers: { "Authorization": `Bearer ${API_KEY}` },
      });
      const text = await res.text();
      if (res.ok) {
        pass++;
        passes.push({ path, status: res.status, size: text.length });
      } else {
        fail++;
        failures.push({ path, status: res.status, body: text.slice(0, 150) });
      }
    } catch (e) {
      fail++;
      failures.push({ path, status: 0, body: e.message });
    }
  }

  // Print first 15 successes
  console.log("SAMPLE PASSES:");
  for (const p of passes.slice(0, 15)) {
    console.log(`  ✓ GET ${p.path} -> ${p.status} (${p.size}B)`);
  }
  if (passes.length > 15) console.log(`  ... and ${passes.length - 15} more passes`);

  console.log("---");
  console.log(`[smoke] PASS: ${pass}/${endpoints.length}  FAIL: ${fail}`);

  if (fail > 0) {
    console.log("\nFAILURES (first 20):");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ✗ GET ${f.path} -> ${f.status}`);
      console.log(`    ${f.body}`);
    }
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more failures`);
  }

  // Negative tests
  console.log("\n[smoke] negative tests:");
  const noAuth = await fetch(`${BASE}/api/v1/profiles`);
  console.log(`  no auth -> ${noAuth.status} (expect 401)`);
  const badKey = await fetch(`${BASE}/api/v1/profiles`, {
    headers: { Authorization: "Bearer sk_live_invalid" },
  });
  console.log(`  bad key -> ${badKey.status} (expect 401)`);

  process.exit(fail > 0 ? 1 : 0);
})();
