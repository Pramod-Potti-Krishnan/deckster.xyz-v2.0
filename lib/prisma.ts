// Prisma Client singleton instance
// Prevents multiple instances in all environments (critical for serverless)

import { PrismaClient } from '@prisma/client'

console.log('[Prisma] Initializing Prisma Client...')
console.log('[Prisma] Environment:', process.env.NODE_ENV)
console.log('[Prisma] DATABASE_URL configured:', !!process.env.DATABASE_URL)
console.log('[Prisma] DATABASE_URL prefix:', process.env.DATABASE_URL?.substring(0, 30) + '...')
console.log('[Prisma] DIRECT_URL configured:', !!process.env.DIRECT_URL)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  console.log('[Prisma] Creating new PrismaClient instance')
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Connection pool settings for serverless (Supabase Transaction Pooler)
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// CRITICAL: Use singleton in ALL environments (including production)
// This prevents exhausting database connections in Vercel serverless
globalForPrisma.prisma = prisma

console.log('[Prisma] PrismaClient instance ready')

export default prisma
