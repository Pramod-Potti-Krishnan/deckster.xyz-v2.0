/**
 * Studio API hardening v1: the server-side checks (session + DB). Decisions live in lib/api-hardening-core.ts.
 *
 * Every helper is a no-op while STUDIO_API_HARDENING_V1_ENABLED is not exactly "true": it returns null (= proceed)
 * before reading the session or the database, so a route that calls it behaves exactly as it did before.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import {
  approvalVerdict,
  isApiHardeningEnabled,
  sessionOwnershipVerdict,
} from '@/lib/api-hardening-core'

export * from '@/lib/api-hardening-core'

/**
 * Cost routes and token minting: the caller must be an APPROVED user, read live from the DB (never the JWT).
 * Returns a response to send back when denied, or null to proceed.
 */
export async function requireApprovedUser(): Promise<NextResponse | null> {
  if (!isApiHardeningEnabled()) return null
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string | null } | undefined)?.id ?? null
  let found = false
  let approved: boolean | null = null
  let lookupFailed = false
  if (userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { approved: true } })
      found = !!user
      approved = user?.approved ?? null
    } catch (error) {
      console.error('[API hardening] approval lookup failed:', error)
      lookupFailed = true
    }
  }
  const verdict = approvalVerdict({ enabled: true, userId, found, approved, lookupFailed })
  return verdict.allowed ? null : NextResponse.json({ error: verdict.error }, { status: verdict.status })
}

/**
 * The ChatSession named by the caller must exist and belong to the signed-in user, and a presentation id must not
 * be recorded on another user's session. Returns a response when denied, or null to proceed.
 */
export async function requireSessionOwner(
  userId: string | null | undefined,
  sessionId: unknown,
  presentationId?: unknown,
): Promise<NextResponse | null> {
  if (!isApiHardeningEnabled()) return null
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sid = typeof sessionId === 'string' ? sessionId.trim() : ''
  const pid = typeof presentationId === 'string' ? presentationId.trim() : ''
  try {
    const chatSession = sid
      ? await prisma.chatSession.findUnique({ where: { id: sid }, select: { userId: true, status: true } })
      : null
    const presentationOwners = pid
      ? await prisma.chatSession.findMany({
          where: {
            OR: [
              { blankPresentationId: pid },
              { strawmanPresentationId: pid },
              { finalPresentationId: pid },
            ],
          },
          select: { userId: true },
          take: 20,
        })
      : []
    const verdict = sessionOwnershipVerdict({
      userId,
      sessionId: sid,
      sessionOwnerId: chatSession?.userId,
      sessionStatus: chatSession?.status,
      presentationOwnerIds: presentationOwners.map((row) => row.userId),
    })
    return verdict.allowed ? null : NextResponse.json({ error: verdict.error }, { status: verdict.status })
  } catch (error) {
    console.error('[API hardening] session ownership lookup failed:', error)
    return NextResponse.json({ error: 'Could not verify session ownership' }, { status: 503 })
  }
}

/** Count rate events in a bucket since `since`, for a scope (e.g. a deck id) and/or a subject (an IP hash). */
export async function countRateEvents(where: {
  bucket: string
  scope?: string
  subject?: string
  since: Date
}): Promise<number> {
  return prisma.apiRateEvent.count({
    where: {
      bucket: where.bucket,
      ...(where.scope ? { scope: where.scope } : {}),
      ...(where.subject ? { subject: where.subject } : {}),
      createdAt: { gte: where.since },
    },
  })
}

export async function recordRateEvent(bucket: string, scope: string, subject: string): Promise<void> {
  try {
    await prisma.apiRateEvent.create({ data: { bucket, scope, subject } })
  } catch (error) {
    console.error('[API hardening] could not record a rate event:', error)
  }
}
