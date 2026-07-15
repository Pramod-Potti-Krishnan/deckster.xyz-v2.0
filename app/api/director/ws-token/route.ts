import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { isKgEntitled } from '@/lib/kg-entitlement'
import { prisma } from '@/lib/prisma'
import { getUserSubscription } from '@/lib/stripe/stripe-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_TTL_SECONDS = 15 * 60

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

/**
 * Mint a short-lived, session-bound identity token for the public Director
 * WebSocket. The browser cannot authenticate a cross-origin WebSocket with the
 * NextAuth cookie directly, so the server signs the already-authenticated user
 * id and a live KG entitlement snapshot for Director to verify.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionId = request.nextUrl.searchParams.get('session_id')?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const secret = process.env.DIRECTOR_WS_AUTH_SECRET
  if (!secret) {
    // Legacy environments keep working while KG is disabled. Director fails
    // closed if KG_ENABLED=true without this same secret configured.
    return NextResponse.json({ auth_enabled: false, auth_token: null })
  }

  // Existing session ids must belong to the authenticated user. Director's
  // live connection registry is keyed by session id, so signing an arbitrary
  // other user's id would otherwise let an attacker disconnect that user's
  // socket even though Director derives the data identity from `sub`.
  try {
    const existingSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true },
    })
    if (existingSession && existingSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existingSession?.status === 'deleted') {
      return NextResponse.json({ error: 'Session is deleted' }, { status: 410 })
    }
  } catch (error) {
    console.error('[Director WS Auth] session ownership lookup failed:', error)
    return NextResponse.json(
      { error: 'Could not verify session ownership' },
      { status: 503 },
    )
  }

  let kgEntitled = false
  try {
    const [dbUser, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { tier: true },
      }),
      getUserSubscription(session.user.id),
    ])
    kgEntitled = isKgEntitled(dbUser?.tier, subscription)
  } catch (error) {
    // Identity authentication remains available even if billing lookup is
    // degraded, but KG access fails closed in the signed claim.
    console.error('[Director WS Auth] live KG entitlement lookup failed:', error)
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlJson({
    sub: session.user.id,
    sid: sessionId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    kg_entitled: kgEntitled,
  })
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')

  return NextResponse.json({
    auth_enabled: true,
    auth_token: `${payload}.${signature}`,
    expires_in: TOKEN_TTL_SECONDS,
  })
}
