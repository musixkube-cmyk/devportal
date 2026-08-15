// Verify the dashboard's Prisma queries work after the env fix.
// Simulates what /dashboard/page.tsx and /dashboard/layout.tsx do.

import { PrismaClient } from "@prisma/client";

// Same defensive env setup as src/lib/db.ts
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
  if (process.env.SUPABASE_DB_POOLER_URL) {
    process.env.DATABASE_URL = process.env.SUPABASE_DB_POOLER_URL;
  }
}

// Load .env.local manually (node doesn't auto-load)
import fs from "node:fs";
const envMap = {};
for (const f of [".env", ".env.local"]) {
  try {
    const txt = fs.readFileSync(f, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (!envMap[m[1]]) envMap[m[1]] = v;
    }
  } catch {}
}
if (!process.env.DATABASE_URL && envMap.SUPABASE_DB_POOLER_URL) {
  process.env.DATABASE_URL = envMap.SUPABASE_DB_POOLER_URL;
}
if (!process.env.DATABASE_URL && envMap.DATABASE_URL) {
  process.env.DATABASE_URL = envMap.DATABASE_URL;
}

console.log("DATABASE_URL starts with:", process.env.DATABASE_URL?.slice(0, 25));

const prisma = new PrismaClient();

const TEST_USER_ID = "test-user-id";

async function main() {
  console.log("\n--- 1. ensureDeveloperProfile (upsert) ---");
  const profile = await prisma.developerProfile.upsert({
    where: { userId: TEST_USER_ID },
    update: {},
    create: { userId: TEST_USER_ID },
  });
  console.log("✓ profile upserted:", profile.id, "userId:", profile.userId);

  console.log("\n--- 2. apiKey.count ---");
  const keyCount = await prisma.apiKey.count({ where: { userId: TEST_USER_ID } });
  console.log("✓ keyCount:", keyCount);

  console.log("\n--- 3. webhook.count ---");
  const webhookCount = await prisma.webhook.count({ where: { userId: TEST_USER_ID } });
  console.log("✓ webhookCount:", webhookCount);

  console.log("\n--- 4. apiKey.findMany ---");
  const keys = await prisma.apiKey.findMany({
    where: { userId: TEST_USER_ID },
    orderBy: { createdAt: "desc" },
  });
  console.log("✓ keys:", keys.length);

  console.log("\n--- 5. developerProfile.findUnique ---");
  const found = await prisma.developerProfile.findUnique({
    where: { userId: TEST_USER_ID },
  });
  console.log("✓ profile found:", found?.id);

  console.log("\n✅ All dashboard Prisma queries succeed");

  // Clean up
  await prisma.developerProfile.delete({ where: { userId: TEST_USER_ID } }).catch(() => {});
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("✗ Failed:", e.message);
  process.exit(1);
});
