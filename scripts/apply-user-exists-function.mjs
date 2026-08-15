// One-off script: creates the user_exists_by_email(p_email text) Postgres
// function in the linked Supabase project. Idempotent — uses CREATE OR REPLACE.
//
// Run with: node scripts/apply-user-exists-function.mjs
//
// Why a script instead of `supabase db push`? The CLI's migration tracking
// wasn't picking up the file (likely needs the migrations history table set
// up first). Direct SQL execution is simpler for a one-off function add.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const createSql = `
CREATE OR REPLACE FUNCTION public.user_exists_by_email(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = lower(p_email));
$$;
`;

const revokeSql = `
REVOKE EXECUTE ON FUNCTION public.user_exists_by_email(text) FROM PUBLIC;
`;

try {
  await prisma.$executeRawUnsafe(createSql);
  console.log("✓ Function public.user_exists_by_email(text) created");
  await prisma.$executeRawUnsafe(revokeSql);
  console.log("✓ Revoked execute from PUBLIC (service_role still has access)");
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
