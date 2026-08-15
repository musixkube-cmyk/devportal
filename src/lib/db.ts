import { PrismaClient } from '@prisma/client'

// Defensive: Prisma's auto-env-loader has historically been flaky — sometimes
// it picks up a stray `.env` from a nested directory (e.g. repos/landing-home),
// sometimes Next.js's env loading happens after PrismaClient instantiates.
// Setting DATABASE_URL explicitly before `new PrismaClient()` guarantees
// Prisma sees the right value no matter what.
//
// SUPABASE_DB_POOLER_URL is set explicitly in .env.local and always wins.
// If it's not set, fall back to whatever DATABASE_URL is already in env.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgres')) {
  if (process.env.SUPABASE_DB_POOLER_URL) {
    process.env.DATABASE_URL = process.env.SUPABASE_DB_POOLER_URL
  } else if (process.env.DIRECT_URL && process.env.DIRECT_URL.startsWith('postgres')) {
    // Session-mode pooler (port 5432) is also fine for runtime queries
    process.env.DATABASE_URL = process.env.DIRECT_URL
  }
}

// Singleton Prisma client. Avoids spawning a new connection pool per hot
// reload in development (which would exhaust the Supabase pooler's
// connection limit).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
