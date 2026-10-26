import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { mintRestEntitlement, REST_ENTITLEMENT_HEADER } from '@/lib/director-rest-entitlement'
import {
  DUPLICATE_ADOPT_BODY_MAX_BYTES,
  DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS,
  directorAdoptBody,
  duplicateAdoptRefusal,
  isPlainAdoptId,
  parseAdoptRequestBody,
} from '@/lib/studio-duplicate-adopt'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// DUPLICATE A DECK, STEP 4 (flag NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT, exact "true", default off; it acts only while NEXT_PUBLIC_STUDIO_DUPLICATE_DECK is "true" too): the Director adopts a Layout copy
// into the copy's NEW session, so chat can edit it. POST /api/sessions/{session_id}/adopt-duplicate on the Director (Director !561, DIRECTOR_DUPLICATE_ADOPT_ENABLED; contract
// streams/director2/dup-adopt/CONTRACT.md). With either flag off this route does not exist: 404 before the session is read or the Director is called. NEXT_PUBLIC_ is inlined at build time.
//
// The path segment is the NEW session's id. Next allows one slug name per path level, and the sibling handoff route already names this level [sourceSessionId], so the folder keeps that name.
// The browser sends { presentation_id } and nothing else. The user id is the login's (session.user.id || session.user.email, exactly as the handoff route and the Director WebSocket session use
// it), never the browser's. The Director gets exactly { user_id, presentation_id }.
//
// REST entitlement: the signed X-Deckster-Entitlement header is minted HERE, on the server, per request, for that same user id, method POST. UNCONDITIONALLY: the Director requires it on this route
// even while its DIRECTOR_REST_ENTITLEMENT_* flags are off (contract section 2), so this route does not wait for DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED. Without a signing secret no header can be
// made and the Director refuses (401). The header is never logged and never sent to the browser.
//
// The Director's status and body are passed through as they came (its refusals carry { error, code, detail, retryable }). A Director that cannot be reached is 502 retryable; an answer that is not JSON
// keeps its status and is retryable when that status is a 5xx.

function directorBaseUrl(): string {
  return requireServiceUrl('Director', [
    { name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL },
    { name: 'NEXT_PUBLIC_DIRECTOR_API_URL', value: process.env.NEXT_PUBLIC_DIRECTOR_API_URL },
  ], { stripTrailingSlash: true })
}

type SessionUser = {
  id?: string | null
  email?: string | null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sourceSessionId: string }> },
) {
  if (process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK !== 'true' || process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as SessionUser | undefined
  const userId = sessionUser?.id || sessionUser?.email
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sourceSessionId: sessionId } = await context.params
  if (!isPlainAdoptId(sessionId)) {
    return NextResponse.json(duplicateAdoptRefusal('REQUEST_INVALID', false), { status: 400 })
  }
  let presentationId: string
  try {
    const declared = Number(req.headers.get('content-length') ?? '0')
    if (declared > DUPLICATE_ADOPT_BODY_MAX_BYTES) throw new Error('too large')
    const text = await req.text()
    if (Buffer.byteLength(text, 'utf8') > DUPLICATE_ADOPT_BODY_MAX_BYTES) throw new Error('too large')
    const checked = parseAdoptRequestBody(JSON.parse(text))
    if (!checked.ok) throw new Error('invalid body')
    presentationId = checked.presentationId
  } catch {
    return NextResponse.json(duplicateAdoptRefusal('REQUEST_INVALID', false), { status: 400 })
  }

  try {
    let entitlement: string | null = null
    try {
      entitlement = mintRestEntitlement({ sub: userId, method: 'POST' })
    } catch {
      entitlement = null
    }
    const response = await fetch(
      `${directorBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/adopt-duplicate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(entitlement ? { [REST_ENTITLEMENT_HEADER]: entitlement } : {}) },
        body: directorAdoptBody(userId, presentationId),
        cache: 'no-store',
        signal: AbortSignal.timeout(DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS),
      },
    )
    const text = await response.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = undefined
    }
    if (data === undefined || data === null || typeof data !== 'object') {
      return NextResponse.json(duplicateAdoptRefusal('DIRECTOR_BAD_RESPONSE', response.status >= 500), { status: response.status })
    }
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code, retryable: false }, { status: 503 })
    return NextResponse.json(duplicateAdoptRefusal('DIRECTOR_UNREACHABLE', true), { status: 502 })
  }
}
