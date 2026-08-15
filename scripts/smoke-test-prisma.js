require("dotenv").config({ path: ".env", override: true });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const tables = await p.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'devportal'
     ORDER BY table_name;`,
  );
  console.log("Tables in devportal schema:");
  tables.forEach((t) => console.log("  -", t.table_name));

  // Sanity insert + read on ApiKey
  const created = await p.apiKey.create({
    data: {
      userId: "test-user-id",
      name: "Smoke test key",
      prefix: "sk_live_ab12cd34",
      hash: "argon2id$dummy",
      environment: "test",
      scope: "read",
    },
  });
  console.log("\nInserted test ApiKey:", created.id);

  const list = await p.apiKey.findMany({
    where: { userId: "test-user-id" },
    select: { id: true, name: true, prefix: true, environment: true, scope: true },
  });
  console.log("ApiKey query result:", list);

  await p.apiKey.delete({ where: { id: created.id } });
  console.log("Cleaned up test row.");

  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
