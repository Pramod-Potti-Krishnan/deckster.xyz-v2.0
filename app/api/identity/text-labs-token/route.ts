import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import {
  TEXT_LABS_IDENTITY_HEADER,
  isTextLabsSubject,
  mintTextLabsToken,
  textLabsSignedRequestsEnabled,
  textLabsSigningSecret,
} from '@/lib/text-labs-identity-mint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Text Labs signed requests (flag TEXT_LABS_SIGNED_REQUESTS_ENABLED, default off): a short-lived token for the signed-in user, which
 * the browser sends as X-MR-Identity-Token on Text Labs' two paid routes. Flag off: {"token_enabled": false} and nothing is read or
 * issued. Logs carry reason codes only, never the token, the secret or the user id.
 */
export async function GET() {
  if (!textLabsSignedRequestsEnabled()) {
    return NextResponse.json({ token_enabled: false }, { headers: NO_STORE })
  }
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE })
  }
  if (!isTextLabsSubject(userId)) {
    console.warn('[Text Labs token] refused: invalid_identity')
    return NextResponse.json({ error: 'invalid_identity' }, { status: 401, headers: NO_STORE })
  }
  const secret = textLabsSigningSecret()
  if (!secret) {
    console.error('[Text Labs token] refused: identity_signing_not_configured')
    return NextResponse.json({ error: 'identity_signing_not_configured' }, { status: 503, headers: NO_STORE })
  }
  return NextResponse.json({ ...mintTextLabsToken(userId, secret), header: TEXT_LABS_IDENTITY_HEADER }, { headers: NO_STORE })
}
