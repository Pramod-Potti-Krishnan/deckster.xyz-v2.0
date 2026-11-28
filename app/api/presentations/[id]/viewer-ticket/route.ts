import { NextResponse } from 'next/server'

import { getLayoutServiceBaseUrl } from '@/lib/publish/service-urls'
import { dbVerifiedSessionUserId } from '@/lib/studio-director-rest-sign'
import { isStudioLayoutTicketEnabled } from '@/lib/studio-layout-viewer-ticket'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

function refuse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status, headers: NO_STORE })
}

/**
 * PL-46: the scope the caller asks for, Layout's own query parameter `scope` ("edit" or "view"; absent = view, Layout's default). null = not asked
 * (nothing is forwarded, exactly the request of before); 'invalid' = anything else (a repeated, empty, other-case or other-valued parameter).
 */
function requestedScope(req: { url?: string } | undefined): 'edit' | 'view' | null | 'invalid' {
  if (typeof req?.url !== 'string') return null
  let values: string[]
  try { values = new URL(req.url, 'http://studio.invalid').searchParams.getAll('scope') } catch { return 'invalid' }
  if (values.length === 0) return null
  return values.length === 1 && (values[0] === 'edit' || values[0] === 'view') ? values[0] : 'invalid'
}

/**
 * POST /api/presentations/{id}/viewer-ticket: mint a Layout viewer ticket (program1/layout-auth-v2) for the signed-in user.
 *
 * The service token stays here: X-Layout-Service-Token (server-only LAYOUT_SERVICE_TOKEN) + X-Deckster-User-Id (the DB-verified
 * session user id). Layout enforces the deck owner (403 when the deck's owner_user_id is someone else). Returns Layout's
 * {ticket, expires_in, url} unchanged. Flag NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED off: 404, nothing sent.
 *
 * PL-46: ?scope=edit|view is forwarded as Layout's own `scope` query parameter (only the owner's editing frame asks for edit); anything else is
 * refused with 400 before Layout is called. Layout's owner check alone decides: its answer (403 for a deck that is not the user's, or has no owner) is
 * passed through unchanged, never retried with another scope.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStudioLayoutTicketEnabled()) return refuse('not_enabled', 404)
  const { id } = await params
  if (!ID_PATTERN.test(id)) return refuse('invalid_presentation_id', 400)
  const scope = requestedScope(req)
  if (scope === 'invalid') return refuse('invalid_scope', 400)

  let userId: string | null
  try {
    userId = await dbVerifiedSessionUserId()
  } catch {
    return refuse('identity_lookup_failed', 503)
  }
  if (!userId) return refuse('Unauthorized', 401)

  const token = process.env.LAYOUT_SERVICE_TOKEN
  if (!token) return refuse('ticket_not_configured', 503)

  let base: string
  try {
    base = getLayoutServiceBaseUrl().replace(/\/$/, '')
  } catch {
    return refuse('layout_not_configured', 503)
  }
  try {
    const upstream = await fetch(`${base}/api/presentations/${encodeURIComponent(id)}/viewer-ticket${scope ? `?scope=${scope}` : ''}`, {
      method: 'POST',
      headers: { 'X-Layout-Service-Token': token, 'X-Deckster-User-Id': userId },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...NO_STORE, 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return refuse('layout_unreachable', 502)
  }
}
