import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export async function GET() {
  const results = []

  console.log('='.repeat(80))
  console.log('[DB Test] Starting comprehensive database connection tests...')
  console.log('[DB Test] Timestamp:', new Date().toISOString())
  console.log('[DB Test] Environment:', process.env.NODE_ENV)
  console.log('[DB Test] Current DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))
  console.log('='.repeat(80))

  // Test 1: Current DATABASE_URL from env
  try {
    console.log('\n[DB Test 1] Testing current DATABASE_URL from environment...')
    console.log('[DB Test 1] Creating PrismaClient with env DATABASE_URL')
    const prisma1 = new PrismaClient({
      log: ['query', 'error', 'warn', 'info']
    })
    console.log('[DB Test 1] Attempting $connect()')
    await prisma1.$connect()
    console.log('[DB Test 1] ✅ Connection successful!')
    console.log('[DB Test 1] Testing query: SELECT 1')
    await prisma1.$queryRaw`SELECT 1`
    console.log('[DB Test 1] ✅ Query successful!')
    await prisma1.$disconnect()
    console.log('[DB Test 1] Disconnected')
    results.push({
      test: 'Current DATABASE_URL from env',
      status: 'SUCCESS',
      url: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')
    })
  } catch (error: any) {
    console.error('[DB Test 1] ❌ FAILED:', error.message)
    console.error('[DB Test 1] Error code:', error.code)
    console.error('[DB Test 1] Error meta:', error.meta)
    results.push({
      test: 'Current DATABASE_URL from env',
      status: 'FAILED',
      error: error.message,
      code: error.code,
      url: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')
    })
  }

  // Test 2: Direct connection (port 5432) - IPv6
  try {
    console.log('\n[DB Test 2] Testing direct connection (IPv6, port 5432)...')
    const testUrl = 'postgresql://postgres:V0Kjd1FanzQXn9Q7@db.eshvntffcestlfuofwhv.supabase.co:5432/postgres'
    console.log('[DB Test 2] URL:', testUrl.replace(/:[^:@]+@/, ':***@'))
    const prisma2 = new PrismaClient({
      datasources: {
        db: {
          url: testUrl
        }
      },
      log: ['query', 'error', 'warn', 'info']
    })
    console.log('[DB Test 2] Attempting $connect()')
    await prisma2.$connect()
    console.log('[DB Test 2] ✅ Connection successful!')
    console.log('[DB Test 2] Testing query: SELECT 1')
    await prisma2.$queryRaw`SELECT 1`
    console.log('[DB Test 2] ✅ Query successful!')
    await prisma2.$disconnect()
    console.log('[DB Test 2] Disconnected')
    results.push({
      test: 'Direct connection (IPv6, port 5432)',
      status: 'SUCCESS',
      url: testUrl.replace(/:[^:@]+@/, ':***@')
    })
  } catch (error: any) {
    console.error('[DB Test 2] ❌ FAILED:', error.message)
    console.error('[DB Test 2] Error code:', error.code)
    console.error('[DB Test 2] Error meta:', error.meta)
    results.push({
      test: 'Direct connection (IPv6, port 5432)',
      status: 'FAILED',
      error: error.message,
      code: error.code
    })
  }

  // Test 3: Session pooler (Supavisor) - IPv4 compatible
  try {
    console.log('\n[DB Test 3] Testing Session pooler (Supavisor, IPv4, port 5432)...')
    const testUrl = 'postgresql://postgres.eshvntffcestlfuofwhv:V0Kjd1FanzQXn9Q7@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
    console.log('[DB Test 3] URL:', testUrl.replace(/:[^:@]+@/, ':***@'))
    console.log('[DB Test 3] Note: Using postgres.PROJECT_REF username format')
    const prisma3 = new PrismaClient({
      datasources: {
        db: {
          url: testUrl
        }
      },
      log: ['query', 'error', 'warn', 'info']
    })
    console.log('[DB Test 3] Attempting $connect()')
    await prisma3.$connect()
    console.log('[DB Test 3] ✅ Connection successful!')
    console.log('[DB Test 3] Testing query: SELECT 1')
    await prisma3.$queryRaw`SELECT 1`
    console.log('[DB Test 3] ✅ Query successful!')
    await prisma3.$disconnect()
    console.log('[DB Test 3] Disconnected')
    results.push({
      test: 'Session pooler (Supavisor, IPv4, port 5432)',
      status: 'SUCCESS',
      url: testUrl.replace(/:[^:@]+@/, ':***@')
    })
  } catch (error: any) {
    console.error('[DB Test 3] ❌ FAILED:', error.message)
    console.error('[DB Test 3] Error code:', error.code)
    console.error('[DB Test 3] Error meta:', error.meta)
    results.push({
      test: 'Session pooler (Supavisor, IPv4, port 5432)',
      status: 'FAILED',
      error: error.message,
      code: error.code
    })
  }

  // Test 4: Transaction pooler with pgbouncer (recommended for Vercel)
  try {
    console.log('\n[DB Test 4] Testing Transaction pooler (Supavisor, IPv4, port 6543)...')
    const testUrl = 'postgresql://postgres.eshvntffcestlfuofwhv:V0Kjd1FanzQXn9Q7@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
    console.log('[DB Test 4] URL:', testUrl.replace(/:[^:@]+@/, ':***@'))
    console.log('[DB Test 4] Note: Using postgres.PROJECT_REF username + pgbouncer=true')
    const prisma4 = new PrismaClient({
      datasources: {
        db: {
          url: testUrl
        }
      },
      log: ['query', 'error', 'warn', 'info']
    })
    console.log('[DB Test 4] Attempting $connect()')
    await prisma4.$connect()
    console.log('[DB Test 4] ✅ Connection successful!')
    console.log('[DB Test 4] Testing query: SELECT 1')
    await prisma4.$queryRaw`SELECT 1`
    console.log('[DB Test 4] ✅ Query successful!')
    await prisma4.$disconnect()
    console.log('[DB Test 4] Disconnected')
    results.push({
      test: 'Transaction pooler (Supavisor, IPv4, port 6543)',
      status: 'SUCCESS',
      url: testUrl.replace(/:[^:@]+@/, ':***@')
    })
  } catch (error: any) {
    console.error('[DB Test 4] ❌ FAILED:', error.message)
    console.error('[DB Test 4] Error code:', error.code)
    console.error('[DB Test 4] Error meta:', error.meta)
    results.push({
      test: 'Transaction pooler (Supavisor, IPv4, port 6543)',
      status: 'FAILED',
      error: error.message,
      code: error.code
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('[DB Test] All tests completed')
  console.log('[DB Test] Summary:')
  results.forEach((r, i) => {
    console.log(`  Test ${i + 1}: ${r.test} - ${r.status}`)
  })
  console.log('='.repeat(80))

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    currentDatabaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'),
    tests: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'SUCCESS').length,
      failed: results.filter(r => r.status === 'FAILED').length
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
    }
  })
}
