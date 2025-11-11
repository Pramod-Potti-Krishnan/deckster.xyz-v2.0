import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Only allow in development or if a special debug token is provided
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const envCheck = {
    DATABASE_URL: !!process.env.DATABASE_URL ? 'SET' : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'MISSING',
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET ? 'SET (length: ' + process.env.NEXTAUTH_SECRET?.length + ')' : 'MISSING',
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
    DEV_BYPASS_EMAIL: process.env.DEV_BYPASS_EMAIL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  }

  return NextResponse.json(envCheck, { status: 200 })
}
