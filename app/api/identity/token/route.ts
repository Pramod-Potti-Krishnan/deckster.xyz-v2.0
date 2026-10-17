import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import {
  IDENTITY_TOKEN_HEADER,
  identityTokenSecret,
  isIdentityId,
  isIdentityTokenEnabled,
  mintIdentityToken,
} from '@/lib/identity-token'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tokens are per user and per session; nothing here may be cached or shared.
const NO_STORE = { 'Cache-Control': 'no-store' }

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

/**
 * R-20261007-frontend-24: mint the short-lived session token the Researcher
 * verifies (contract identity/v1, K-06 `v1.` format; see lib/identity-token.ts).
 *
 * GET /api/identity/token?session_id=<chat session id>
 *
 * Same shape as the Director WS token route: the NextAuth cookie proves who
 * the caller is, the chat session must belong to them, and the signed claims
 * come only from those two checks. Dark by default: with
 * DECKSTER_IDENTITY_TOKEN_ENABLED off, or no usable
 * RESEARCHER_SESSION_TOKEN_SECRET, it answers `{ token_enabled: false }` and
 * issues nothing. Nothing in the app calls it yet.
 *
 * Logs carry route-level reason codes only: never a token, a secret, or an id.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  // The account id only: never fall back to the e-mail, and never sign an id
  // that is not canonical (an e-mail or a '|' would otherwise mint fine).
  if (!isIdentityId(userId)) {
    console.warn(`[identity-token] refused: ${userId ? 'non_canonical_user_id' : 'no_user_id'}`)
    return respond({ error: 'unauthenticated' }, 401)
  }

  const secret = identityTokenSecret()
  if (!isIdentityTokenEnabled() || !secret) {
    return respond({ token_enabled: false })
  }

  const sessionId = request.nextUrl.searchParams.get('session_id')?.trim()
  if (!sessionId) {
    return respond({ error: 'session_id_required' }, 400)
  }
  if (!isIdentityId(sessionId)) {
    return respond({ error: 'invalid_session_id' }, 400)
  }

  // As in the WS token route: an existing chat session must belong to the
  // caller and must not be deleted. A session id not yet persisted is allowed
  // (uploads can start before the row exists); the token then binds only the
  // caller's own account id to that id.
  try {
    const existingSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true },
    })
    if (existingSession && existingSession.userId !== userId) {
      return respond({ error: 'session_not_owned' }, 403)
    }
    if (existingSession?.status === 'deleted') {
      return respond({ error: 'session_deleted' }, 410)
    }
  } catch {
    console.error('[identity-token] refused: ownership_lookup_failed')
    return respond({ error: 'ownership_lookup_failed' }, 503)
  }

  const minted = mintIdentityToken({ secret, sessionId, userId })
  if (!minted) {
    console.error('[identity-token] refused: mint_failed')
    return respond({ error: 'identity_signing_not_configured' }, 503)
  }

  return respond({
    token: minted.token,
    expires_at: minted.expiresAt,
    header: IDENTITY_TOKEN_HEADER,
    ttl_seconds: minted.ttlSeconds,
  })
}
