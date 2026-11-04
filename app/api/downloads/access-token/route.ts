import { NextResponse } from 'next/server'

import { isStudioDownloadsAuthEnabled, mintSupabaseAccessToken } from '@/lib/downloads-access-token'
import { dbVerifiedSessionUserId } from '@/lib/studio-director-rest-sign'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/downloads/access-token: a short-lived Supabase-format access token for the signed-in user (sub = DB user id),
 * sent by the browser as `Authorization: Bearer` to Downloads. Flag NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED off: 404.
 * Never logged.
 */
export async function GET() {
  if (!isStudioDownloadsAuthEnabled()) return NextResponse.json({ error: 'not_enabled' }, { status: 404, headers: NO_STORE })
  let userId: string | null
  try {
    userId = await dbVerifiedSessionUserId()
  } catch {
    return NextResponse.json({ error: 'identity_lookup_failed' }, { status: 503, headers: NO_STORE })
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  const minted = mintSupabaseAccessToken({ secret: process.env.SUPABASE_JWT_SECRET ?? '', sub: userId })
  if (!minted) return NextResponse.json({ error: 'token_not_configured' }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ access_token: minted.token, token_type: 'bearer', expires_at: minted.expiresAt }, { headers: NO_STORE })
}
