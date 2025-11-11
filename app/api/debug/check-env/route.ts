import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Simple check to see what env vars are available
  const envCheck = {
    timestamp: new Date().toISOString(),
    hasNEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    hasNEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    hasGOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    hasGOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    hasDATABASE_URL: !!process.env.DATABASE_URL,
    NEXTAUTH_URL_value: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET_length: process.env.NEXTAUTH_SECRET?.length,
    NEXTAUTH_SECRET_first10: process.env.NEXTAUTH_SECRET?.substring(0, 10),
    NODE_ENV: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key =>
      key.includes('NEXTAUTH') ||
      key.includes('GOOGLE') ||
      key.includes('DATABASE')
    ),
  }

  return NextResponse.json(envCheck, { status: 200 })
}
