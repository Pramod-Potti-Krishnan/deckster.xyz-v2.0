import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { dbVerifiedSessionUserId, directorRestSignHeaders } from '@/lib/studio-director-rest-sign'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

/**
 * GET /api/director/sessions/{sessionId}/library: owner-checked proxy for Director GET /sessions/{id}/library.
 *
 * 1. The caller's DB user id (NextAuth session -> users table by id, else by e-mail).
 * 2. The chat session must belong to that user and not be deleted (not found and not yours read the same: 404).
 * 3. The Director call carries X-Deckster-Entitlement for that DB id (STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED; off = unsigned).
 * The Director answer is returned unchanged.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ sourceSessionId: string }> }) {
  const { sourceSessionId: sessionId } = await params
  if (!ID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: 'invalid_session_id' }, { status: 400, headers: NO_STORE })
  }

  let userId: string | null
  try {
    userId = await dbVerifiedSessionUserId()
  } catch {
    return NextResponse.json({ error: 'ownership_lookup_failed' }, { status: 503, headers: NO_STORE })
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })

  try {
    const chatSession = await prisma.chatSession.findUnique({ where: { id: sessionId }, select: { userId: true, status: true } })
    if (!chatSession || chatSession.userId !== userId || chatSession.status === 'deleted') {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404, headers: NO_STORE })
    }
  } catch {
    return NextResponse.json({ error: 'ownership_lookup_failed' }, { status: 503, headers: NO_STORE })
  }

  try {
    const base = requireServiceUrl('Director', [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }]).replace(/\/$/, '')
    const upstream = await fetch(`${base}/sessions/${encodeURIComponent(sessionId)}/library`, {
      cache: 'no-store',
      headers: await directorRestSignHeaders(userId, 'GET'),
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...NO_STORE, 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503, headers: NO_STORE })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502, headers: NO_STORE })
  }
}
