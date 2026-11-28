import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { getKnowledgeServiceUrl } from '@/lib/config'
import { prisma } from '@/lib/prisma'
import { RESEARCHER_UPLOAD_STEPS, isStudioResearcherProxyServerEnabled } from '@/lib/researcher-upload-proxy'
import {
  RESEARCHER_SESSION_TOKEN_HEADER,
  mintResearcherSessionToken,
  researcherSessionTokenSecret,
} from '@/lib/researcher-session-token'
import { ServiceUrlConfigError } from '@/lib/service-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_TTL_SECONDS = 120
const UPSTREAM_TIMEOUT_MS = 60_000
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
const NO_STORE = { 'Cache-Control': 'no-store' }

function refuse(code: string, status: number) {
  // Fixed reason codes only: never a token, a key, a secret, a session id, a user id or an e-mail.
  console.warn(`[researcher-upload-proxy] refused: ${code}`)
  return NextResponse.json({ error: code }, { status, headers: NO_STORE })
}

/**
 * POST /api/researcher/upload/{create-session|storage-upload-url|process-uploaded}?session_id=<chat session>&owner=<email|id>
 *
 * Server half of lib/researcher-upload-proxy.ts. In order:
 *  1. NextAuth account id (never from the client) and the chat session belongs to it (not found / not yours: 404; deleted: 410).
 *  2. The Researcher session the call names (body.session_id; for create it must be the chat session id itself).
 *  3. The owner identity is the caller's own e-mail or account id per `owner`; create's body.user_id is overwritten with it.
 *  4. Forwards with X-API-Key (KNOWLEDGE_API_KEY) and X-Deckster-Session-Token bound to (Researcher session, owner), 120 s.
 * The Researcher then checks the session's durable owner against the token.
 * Dark: STUDIO_RESEARCHER_PROXY_ENABLED off -> 404, nothing sent. Missing key or secret -> 503, never an unauthenticated call.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  if (!isStudioResearcherProxyServerEnabled()) {
    return NextResponse.json({ error: 'not_enabled' }, { status: 404, headers: NO_STORE })
  }
  const { step } = await params
  const researcherPath = Object.prototype.hasOwnProperty.call(RESEARCHER_UPLOAD_STEPS, step) ? RESEARCHER_UPLOAD_STEPS[step] : null
  if (!researcherPath) return refuse('unknown_step', 404)

  const session = await getServerSession(authOptions)
  const accountId = (session?.user as { id?: string } | undefined)?.id
  if (typeof accountId !== 'string' || accountId === '') return refuse('unauthenticated', 401)

  const chatSessionId = request.nextUrl.searchParams.get('session_id')?.trim()
  if (!chatSessionId || !ID_PATTERN.test(chatSessionId)) return refuse('invalid_session_id', 400)
  const ownerKind = request.nextUrl.searchParams.get('owner')
  if (ownerKind !== 'email' && ownerKind !== 'id') return refuse('invalid_owner', 400)

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return refuse('invalid_body', 400)
    body = parsed as Record<string, unknown>
  } catch {
    return refuse('invalid_body', 400)
  }

  try {
    const chatSession = await prisma.chatSession.findUnique({ where: { id: chatSessionId }, select: { userId: true, status: true } })
    if (!chatSession || chatSession.userId !== accountId) return refuse('session_not_found', 404)
    if (chatSession.status === 'deleted') return refuse('session_deleted', 410)
  } catch {
    return refuse('ownership_lookup_failed', 503)
  }

  const researcherSessionId = typeof body.session_id === 'string' ? body.session_id : ''
  if (!ID_PATTERN.test(researcherSessionId)) return refuse('invalid_researcher_session_id', 400)
  if (researcherPath === 'sessions/create' && researcherSessionId !== chatSessionId) return refuse('session_mismatch', 400)

  const ownerId = ownerKind === 'email' ? session?.user?.email : accountId
  if (typeof ownerId !== 'string' || ownerId === '') return refuse('identity_not_signable', 403)
  if (researcherPath === 'sessions/create') body = { ...body, user_id: ownerId }

  const apiKey = process.env.KNOWLEDGE_API_KEY
  const secret = researcherSessionTokenSecret()
  if (!apiKey || !secret) return refuse('signing_not_configured', 503)
  const minted = mintResearcherSessionToken({ secret, sessionId: researcherSessionId, userId: ownerId, ttlSeconds: TOKEN_TTL_SECONDS })
  if (!minted) return refuse('identity_not_signable', 403)

  let base: string
  try {
    base = getKnowledgeServiceUrl().replace(/\/$/, '')
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503, headers: NO_STORE })
    throw error
  }

  let upstream: Response
  try {
    upstream = await fetch(`${base}/api/v1/${researcherPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        [RESEARCHER_SESSION_TOKEN_HEADER]: minted.token,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = (error as { name?: string } | null)?.name === 'TimeoutError'
    return refuse(timedOut ? 'researcher_timeout' : 'researcher_unreachable', timedOut ? 504 : 502)
  }
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...NO_STORE, 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}
