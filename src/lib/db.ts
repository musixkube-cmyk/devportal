import { PrismaClient } from '@prisma/client'

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