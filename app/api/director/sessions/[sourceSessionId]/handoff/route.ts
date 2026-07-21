import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export const maxDuration = 60

const DIRECTOR_API_URL = (
  process.env.DIRECTOR_API_URL ||
  process.env.NEXT_PUBLIC_DIRECTOR_API_URL ||
  'https://directorv33-production.up.railway.app'
).replace(/\/+$/, '')

type SessionUser = {
  id?: string | null
  email?: string | null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sourceSessionId: string }> },
) {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as SessionUser | undefined
  const userId = sessionUser?.id || sessionUser?.email
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const pendingRequest = typeof body.pending_request === 'string'
    ? body.pending_request.trim()
    : ''
  const idempotencyKey = typeof body.idempotency_key === 'string'
    ? body.idempotency_key.trim()
    : ''
  if (!pendingRequest || !idempotencyKey) {
    return NextResponse.json(
      { error: 'pending_request and idempotency_key are required' },
      { status: 400 },
    )
  }

  const { sourceSessionId } = await context.params
  const payload = {
    ...body,
    // Never trust a browser-provided owner id. This must exactly match the id
    // used by the authenticated Director WebSocket session.
    user_id: userId,
    pending_request: pendingRequest,
    idempotency_key: idempotencyKey,
  }

  try {
    const response = await fetch(
      `${DIRECTOR_API_URL}/api/sessions/${encodeURIComponent(sourceSessionId)}/handoff`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
    )
    const text = await response.text()
    let data: unknown = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: text }
      }
    }
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'director_unreachable',
        detail: error instanceof Error ? error.message : 'Director handoff failed',
      },
      { status: 502 },
    )
  }
}
