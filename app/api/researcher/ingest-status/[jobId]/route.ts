import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { getKnowledgeServiceUrl } from '@/lib/config'
import { prisma } from '@/lib/prisma'
import { isIngestStatusAuthEnabled } from '@/lib/researcher-ingest-status-auth'
import {
  RESEARCHER_SESSION_TOKEN_HEADER,
  mintResearcherSessionToken,
  researcherSessionTokenSecret,
} from '@/lib/researcher-session-token'
import { ServiceUrlConfigError } from '@/lib/service-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The token is used once, right here; it never reaches the browser.
const TOKEN_TTL_SECONDS = 120
// Shorter than the poll's own 10 s ceiling, so a wedged Researcher reads as a clean 504.
const UPSTREAM_TIMEOUT_MS = 8000
// Chat session ids and Researcher job ids are UUID-like; nothing else is put in an upstream path.
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

// Per user and per session; nothing here may be cached or shared.
const NO_STORE = { 'Cache-Control': 'no-store' }

function respond(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function refuse(code: string, status: number) {
  // Fixed reason codes only: never a token, a secret, a session id, a user id or an e-mail.
  console.warn(`[researcher-ingest-status] refused: ${code}`)
  return respond({ error: code }, status)
}

/**
 * J6-INGEST-STATUS-AUTH-FE: the Studio half of Researcher MR !235. With the
 * Researcher's RESEARCHER_INGEST_STATUS_AUTH_ENABLED on, its job-status route needs an
 * owner-bound `X-Deckster-Session-Token`; the signing secret is server-only, so the
 * upload's poll comes through here instead of going direct.
 *
 * GET /api/researcher/ingest-status/{jobId}?session_id=<chat session id>&owner=<email|id>
 *
 * What is proven, in order, before anything is signed:
 *  1. NextAuth: who the caller is (the account id from the session, never from the query).
 *  2. The chat session belongs to that caller (ChatSession.userId) and is not deleted.
 *  3. The Researcher session id comes from what the upload saved on that chat session
 *     (ChatSession.geminiStoreName), not from the browser and not assumed equal to the chat id.
 *  4. The token's owner is one of the caller's OWN identities, chosen by `owner`: the
 *     e-mail (what uploads send today) or the account id (once uploads carry it). The
 *     value is read from the NextAuth session; a client cannot name an identity.
 * The Researcher then checks the job's session and that session's durable owner against
 * the token before it returns anything, so a job of another session or user is refused
 * there as well. This route never uses the service key.
 *
 * Dark: with NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED off it answers 404 and
 * does nothing. With it on but no usable RESEARCHER_SESSION_TOKEN_SECRET it answers 503
 * and sends nothing upstream (it never falls back to an unauthenticated poll).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isIngestStatusAuthEnabled()) {
    return respond({ error: 'not_enabled' }, 404)
  }

  const session = await getServerSession(authOptions)
  const accountId = session?.user?.id
  if (typeof accountId !== 'string' || accountId === '') {
    return refuse('unauthenticated', 401)
  }

  const { jobId } = await params
  if (!ID_PATTERN.test(jobId)) {
    return refuse('invalid_job_id', 400)
  }
  const chatSessionId = request.nextUrl.searchParams.get('session_id')?.trim()
  if (!chatSessionId || !ID_PATTERN.test(chatSessionId)) {
    return refuse('invalid_session_id', 400)
  }
  const ownerKind = request.nextUrl.searchParams.get('owner')
  if (ownerKind !== 'email' && ownerKind !== 'id') {
    return refuse('invalid_owner', 400)
  }

  let researcherSessionId: string | null | undefined
  try {
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { userId: true, status: true, geminiStoreName: true },
    })
    // Not found and not yours read the same, as in the session files route.
    if (!chatSession || chatSession.userId !== accountId) {
      return refuse('session_not_found', 404)
    }
    if (chatSession.status === 'deleted') {
      return refuse('session_deleted', 410)
    }
    researcherSessionId = chatSession.geminiStoreName
  } catch {
    return refuse('ownership_lookup_failed', 503)
  }
  if (typeof researcherSessionId !== 'string' || researcherSessionId === '') {
    return refuse('researcher_session_not_saved', 409)
  }

  const secret = researcherSessionTokenSecret()
  if (!secret) {
    return refuse('signing_not_configured', 503)
  }
  const ownerId = ownerKind === 'email' ? session?.user?.email : accountId
  const minted = mintResearcherSessionToken({
    secret,
    sessionId: researcherSessionId,
    userId: typeof ownerId === 'string' ? ownerId : '',
    ttlSeconds: TOKEN_TTL_SECONDS,
  })
  if (!minted) {
    return refuse('identity_not_signable', 403)
  }

  let base: string
  try {
    base = getKnowledgeServiceUrl().replace(/\/$/, '')
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return respond({ error: error.message, code: error.code }, 503)
    throw error
  }

  let upstream: Response
  try {
    upstream = await fetch(`${base}/api/v1/files/ingest-status/${encodeURIComponent(jobId)}`, {
      headers: { [RESEARCHER_SESSION_TOKEN_HEADER]: minted.token },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = (error as { name?: string } | null)?.name === 'TimeoutError'
    return refuse(timedOut ? 'researcher_timeout' : 'researcher_unreachable', timedOut ? 504 : 502)
  }

  // The Researcher's answer, unchanged: the poll reads the same status, body and error shape as a direct one.
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...NO_STORE, 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}
