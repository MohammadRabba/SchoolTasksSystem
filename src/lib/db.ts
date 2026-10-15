import { PrismaClient } from '@prisma/client'

// ============================================================
// Prisma Client — Serverless-friendly (Vercel / Edge / Node)
// ============================================================
//
// On Vercel serverless functions, every cold start instantiates a new Prisma
// Client. To avoid exhausting database connections on Neon, we cache the
// client on `globalThis` so hot invocations reuse it.
//
// In production (PostgreSQL/Neon):
//   - Disable query logging (perf)
//   - Use the direct connection string OR the pooled connection string
//     (Neon's pooled URL ends with `-pooler`)
//
// In development (SQLite):
//   - Verbose query log is kept for debugging

const isProduction = process.env.NODE_ENV === 'production'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['query', 'error', 'warn'],
  })

if (!isProduction) globalForPrisma.prisma = db
