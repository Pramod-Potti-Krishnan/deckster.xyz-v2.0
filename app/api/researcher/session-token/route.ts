import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import {
  RESEARCHER_SESSION_TOKEN_HEADER,
  mintResearcherSessionToken,
  researcherSessionTokenSecret,
} from '@/lib/researcher-session-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The token rides on the browser's upload calls; long enough for one upload and its first polls. */
const TOKEN_TTL_SECONDS = 15 * 60
// Chat session ids are UUID-like; the same canonical shape the ingest-status route accepts.
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

// Per user and per session; nothing here may be cached or shared.
const NO_STORE = { 'Cache-Control': 'no-store' }

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function refuse(code: string, status: number) {
  // Fixed reason codes only: never a token, a secret, a session id, a user id or an e-mail.
  console.warn(`[researcher-session-token] refused: ${code}`)
  return respond({ error: code }, status)
}

/** NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED, the exact string "true" (the browser reads the same flag). */
function uploadSessionTokenEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED === 'true'
}

/**
 * DSB-5a: the session token the browser's Researcher upload calls carry
 * (sessions/create, files/storage-upload-url, files/process-uploaded, the direct
 * files/ingest-status poll), so the Researcher can tell who owns a session it is asked
 * to create (its RESEARCHER_HARDENING_V1_ENABLED guard) instead of trusting the body.
 *
 * GET /api/researcher/session-token?session_id=<chat session id>&owner=<email|id>
 *
 * Dark by default: with the flag NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED off the route
 * answers 404 {error:'Not found'} before anything is read, as the connector routes do (the
 * browser never calls it then).
 *
 * Proven, in order, before anything is signed:
 *  1. NextAuth: who the caller is (the account id from the session, never from the query). 401.
 *  2. A usable RESEARCHER_SESSION_TOKEN_SECRET (32 bytes or more after trimming); otherwise
 *     200 {token_enabled:false}, nothing is read and nothing is issued.
 *  3. The chat session id is canonical (400) and the owner kind is 'email' or 'id' (400).
 *  4. The chat session (ChatSession.id) belongs to the caller (403 session_not_owned; a
 *     session with no row reads the same) and is not deleted (410); a failed lookup is 503.
 *  5. The token's owner is one of the caller's OWN identities, chosen by `owner`: the
 *     e-mail (what uploads send today) or the account id (with #586's owner-cuid flag on),
 *     so it equals the user_id the upload sends to sessions/create. The value is read from
 *     the NextAuth session; a client cannot name an identity.
 * The token (lib/researcher-session-token.ts, K-06 `v1.` format) is for exactly that
 * session id and owner, for 15 minutes. The Researcher session id IS the chat session id
 * (sessions/create is called with it and keys its binding by it).
 */
export async function GET(request: NextRequest) {
  if (!uploadSessionTokenEnabled()) {
    return respond({ error: 'Not found' }, 404)
  }

  const session = await getServerSession(authOptions)
  const accountId = session?.user?.id
  if (typeof accountId !== 'string' || accountId === '') {
    return refuse('unauthenticated', 401)
  }

  const secret = researcherSessionTokenSecret()
  if (!secret) {
    return respond({ token_enabled: false })
  }

  const chatSessionId = request.nextUrl.searchParams.get('session_id')?.trim()
  if (!chatSessionId || !ID_PATTERN.test(chatSessionId)) {
    return refuse('invalid_session_id', 400)
  }
  const ownerKind = request.nextUrl.searchParams.get('owner')
  if (ownerKind !== 'email' && ownerKind !== 'id') {
    return refuse('invalid_owner', 400)
  }

  try {
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { userId: true, status: true },
    })
    if (!chatSession || chatSession.userId !== accountId) {
      return refuse('session_not_owned', 403)
    }
    if (chatSession.status === 'deleted') {
      return refuse('session_deleted', 410)
    }
  } catch {
    return refuse('ownership_lookup_failed', 503)
  }

  const ownerId = ownerKind === 'email' ? session?.user?.email : accountId
  const minted = mintResearcherSessionToken({
    secret,
    sessionId: chatSessionId,
    userId: typeof ownerId === 'string' ? ownerId : '',
    ttlSeconds: TOKEN_TTL_SECONDS,
  })
  if (!minted) {
    return refuse('identity_not_signable', 403)
  }

  return respond({
    token: minted.token,
    expires_at: minted.expiresAt,
    header: RESEARCHER_SESSION_TOKEN_HEADER,
    ttl_seconds: TOKEN_TTL_SECONDS,
  })
}
