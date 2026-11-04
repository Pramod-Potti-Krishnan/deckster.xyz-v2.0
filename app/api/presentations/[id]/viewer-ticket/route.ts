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
 * POST /api/presentations/{id}/viewer-ticket: mint a Layout viewer ticket (program1/layout-auth-v2) for the signed-in user.
 *
 * The service token stays here: X-Layout-Service-Token (server-only LAYOUT_SERVICE_TOKEN) + X-Deckster-User-Id (the DB-verified
 * session user id). Layout enforces the deck owner (403 when the deck's owner_user_id is someone else). Returns Layout's
 * {ticket, expires_in, url} unchanged. Flag NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED off: 404, nothing sent.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStudioLayoutTicketEnabled()) return refuse('not_enabled', 404)
  const { id } = await params
  if (!ID_PATTERN.test(id)) return refuse('invalid_presentation_id', 400)

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
    const upstream = await fetch(`${base}/api/presentations/${encodeURIComponent(id)}/viewer-ticket`, {
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
