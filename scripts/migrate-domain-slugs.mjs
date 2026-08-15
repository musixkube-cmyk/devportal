#!/usr/bin/env node
/**
 * Migrate domain slugs from "d1", "d2", ... "d27" to SEO-friendly
 * kebab-case slugs derived from the domain name (e.g. "Identity & Social
 * Graph" -> "identity-social-graph").
 *
 * Also writes a redirect map to /home/z/my-project/src/data/domain-redirects.json
 * which is consumed by next.config.ts to issue 308 (permanent) redirects
 * from every old /docs/api-reference/dN URL to its new counterpart.
 *
 * Resource slugs are already kebab-case and don't need migration.
 */
import fs from "node:fs";
import path from "node:path";

const DATA_PATH = path.join(
  "/home/z/my-project/src/data",
  "api-reference.json",
);
const REDIRECT_PATH = path.join(
  "/home/z/my-project/src/data",
  "domain-redirects.json",
);

function kebab(name) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const api = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

/** Track slug uniqueness — if two domains collapse to the same slug,
 *  append a numeric suffix to disambiguate. */
const used = new Set();
const redirects = [];

for (const d of api.domains) {
  const oldSlug = d.slug;
  let newSlug = kebab(d.name);

  // Guarantee uniqueness
  if (used.has(newSlug)) {
    let i = 2;
    while (used.has(`${newSlug}-${i}`)) i += 1;
    newSlug = `${newSlug}-${i}`;
  }
  used.add(newSlug);

  if (oldSlug === newSlug) continue;

  redirects.push({
    source: `/docs/api-reference/${oldSlug}`,
    destination: `/docs/api-reference/${newSlug}`,
    permanent: true,
  });

  // Also redirect every resource under the old slug.
  for (const r of d.resources) {
    redirects.push({
      source: `/docs/api-reference/${oldSlug}/${r.slug}`,
      destination: `/docs/api-reference/${newSlug}/${r.slug}`,
      permanent: true,
    });
  }

  d.slug = newSlug;
}

fs.writeFileSync(DATA_PATH, JSON.stringify(api, null, 2) + "\n");
fs.writeFileSync(REDIRECT_PATH, JSON.stringify(redirects, null, 2) + "\n");

console.log(`Migrated ${redirects.length / 1} domain routes.`);
console.log("Sample new slugs:");
for (const d of api.domains.slice(0, 5)) {
  console.log(`  ${d.slug.padEnd(34)} -> ${d.name}`);
}
console.log(`...${api.domains.length} total domains.`);
console.log(`Wrote ${redirects.length} redirects to ${REDIRECT_PATH}`);
