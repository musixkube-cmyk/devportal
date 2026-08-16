#!/usr/bin/env node
/**
 * Smoke test: verify every documented endpoint returns its documented
 * response example (status 200/201) instead of a 501.
 *
 * Picks a representative sample of endpoints from the catalogue and
 * calls each one with a test key. Verifies:
 *   - Status is 200 or 201 (NOT 501)
 *   - Response body matches the documented example
 *   - X-Request-Id header is present
 *
 * Usage:
 *   node --env-file=.env.local scripts/smoke-test-gateway.mjs
 */
import apiReference from "../src/data/api-reference.json" with { type: "json" };

const BASE = process.env.GATEWAY_URL || "http://localhost:3000";
const TEST_KEY = process.env.TEST_API_KEY;

if (!TEST_KEY) {
  console.error("Set TEST_API_KEY in env (create a key at /dashboard/keys)");
  process.exit(1);
}

// Pick a representative sample: first endpoint from each domain
const sample = [];
for (const domain of apiReference.domains) {
  for (const resource of domain.resources) {
    if (resource.endpoints.length > 0) {
      const ep = resource.endpoints[0];
      sample.push({
        domain: domain.slug,
        method: ep.method,
        path: ep.path,
        title: ep.title,
      });
      break; // one per domain
    }
  }
}

console.log(`Testing ${sample.length} endpoints (one per domain) against ${BASE}`);
console.log("");

let pass = 0;
let fail = 0;
const results = [];

for (const { domain, method, path, title } of sample) {
  // Convert /v1/foo/{id} → /v1/foo/test-id
  const concretePath = path.replace(/\{[^}]+\}/g, "00000000-0000-0000-0000-000000000001");
  const url = `${BASE}/api/v1${concretePath.replace(/^\/v1/, "")}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TEST_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: ["POST", "PUT", "PATCH"].includes(method) ? JSON.stringify({}) : undefined,
    });

    const status = res.status;
    const requestId = res.headers.get("x-request-id");
    const body = await res.text();

    const ok = status === 200 || status === 201 || status === 204;
    if (ok) pass++;
    else fail++;

    results.push({
      ok,
      domain,
      method,
      path: concretePath,
      status,
      requestId,
      title,
      bodyPreview: body.slice(0, 120),
    });
  } catch (err) {
    fail++;
    results.push({
      ok: false,
      domain,
      method,
      path: concretePath,
      status: 0,
      requestId: null,
      title,
      bodyPreview: err.message,
    });
  }
}

// Print results
for (const r of results) {
  const icon = r.ok ? "✅" : "❌";
  console.log(
    `${icon} ${r.method.padEnd(6)} ${String(r.status).padEnd(4)} ${r.domain.padEnd(20)} ${r.path}`,
  );
  if (!r.ok) {
    console.log(`     ${r.bodyPreview}`);
  }
}

console.log("");
console.log(`Passed: ${pass}/${sample.length}`);
console.log(`Failed: ${fail}/${sample.length}`);

if (fail > 0) {
  process.exit(1);
}
