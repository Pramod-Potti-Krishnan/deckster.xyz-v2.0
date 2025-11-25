// Prisma Client singleton instance
// Prevents multiple instances in development due to hot-reloading

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
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

console.log('[Prisma] PrismaClient instance ready')

export default prisma
