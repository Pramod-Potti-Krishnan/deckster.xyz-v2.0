/**
 * The runtime around lib/studio-session-patch-allowlist.ts (PL-70 Step A): what PATCH /api/sessions/[id] and POST /api/sessions/[id]/files call.
 *
 * Mode "off" (the default): both functions return null at once, before they read the body, the database or anything else: the routes behave exactly as they did.
 * Mode "shadow": the same checks run, a refusal is only logged (reason code and key names, never a value, id, URL, store name or user id), and the route's own
 *                write follows exactly as it does today; a failure of the guard itself is logged and the write still follows.
 * Mode "enforce": a refusal answers the ONE uniform 400 and nothing is written; the PATCH's valid body is written from the validated data; a failure of the guard
 *                itself (a database error, a missing client method) is NOT a pass: it propagates to the route's own error answer and nothing is written.
 */
import { NextResponse } from 'next/server'
import { LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import {
  SESSION_PATCH_REFUSAL_BODY,
  SESSION_PATCH_REFUSAL_STATUS,
  decideSessionPatch,
  isSessionStoreName,
  sessionPatchLogLine,
  sessionPatchMode,
  type SessionPatchMode,
  type SessionPatchReason,
} from '@/lib/studio-session-patch-allowlist'

/** The one refusal: always the same status, body bytes and headers. */
export function sessionPatchRefusal(): NextResponse {
  return new NextResponse(SESSION_PATCH_REFUSAL_BODY, { status: SESSION_PATCH_REFUSAL_STATUS, headers: { 'Content-Type': 'application/json' } })
}

interface GuardPrisma {
  chatSession: {
    findFirst(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
}

const logRefusal = (mode: 'shadow' | 'enforce', reason: SessionPatchReason, keys: readonly string[]) => {
  try { console.warn(sessionPatchLogLine(mode, reason, keys)) } catch { /* a log that cannot be written never changes the answer */ }
}

type Verdict = { refused: false; data?: Record<string, unknown> } | { refused: true; reason: SessionPatchReason; keys: string[] }

async function judgePatch(args: { prisma: GuardPrisma; userId: string; existing: unknown; body: unknown }): Promise<Verdict> {
  const decision = decideSessionPatch(args.body, { row: args.existing as Record<string, string | null | undefined> | null, urlPolicy: LAYOUT_VIEWER_URL_POLICY })
  if (!decision.ok) return { refused: true, reason: decision.reason, keys: decision.keys }
  // a deck id another user's session already records is not this caller's to write (an existence query, never a list)
  for (const { field, id } of decision.pointerIds) {
    const elsewhere = await args.prisma.chatSession.findFirst({
      where: { userId: { not: args.userId }, OR: [{ blankPresentationId: id }, { strawmanPresentationId: id }, { finalPresentationId: id }] },
      select: { id: true },
    })
    if (elsewhere) return { refused: true, reason: 'pointer_recorded_elsewhere', keys: [field] }
  }
  return { refused: false, data: decision.data }
}

/**
 * PATCH /api/sessions/[id], called after the ownership check and the body parse. Returns a response to send (the uniform refusal, or the enforced write's answer)
 * or null: carry on with the route's own write.
 */
export async function guardSessionPatch(args: {
  mode?: SessionPatchMode
  prisma: GuardPrisma
  userId: string
  sessionId: string
  existing: unknown
  body: unknown
}): Promise<NextResponse | null> {
  const mode = args.mode ?? sessionPatchMode()
  if (mode === 'off') return null
  if (mode === 'shadow') {
    try {
      const verdict = await judgePatch(args)
      if (verdict.refused) logRefusal('shadow', verdict.reason, verdict.keys)
    } catch {
      try { console.warn('[sessions PATCH shadow] guard error') } catch { /* nothing */ }
    }
    return null
  }
  // enforce: nothing in here is allowed to turn into a pass
  const verdict = await judgePatch(args)
  if (verdict.refused) {
    logRefusal('enforce', verdict.reason, verdict.keys)
    return sessionPatchRefusal()
  }
  const updated = await args.prisma.chatSession.update({ where: { id: args.sessionId }, data: { ...verdict.data, updatedAt: new Date() } })
  return NextResponse.json({ session: updated })
}

/**
 * POST /api/sessions/[id]/files, called after the ownership check and the body parse, before anything is created. The browser persists the knowledge store name
 * through this route, so the store is accepted when it is well formed, when the row has none yet or already holds exactly this name, and when no other user's
 * session records it. Returns the uniform refusal (enforce) or null.
 */
export async function guardSessionStoreWrite(args: {
  mode?: SessionPatchMode
  prisma: GuardPrisma
  userId: string
  existing: unknown
  geminiStoreName: unknown
}): Promise<NextResponse | null> {
  const mode = args.mode ?? sessionPatchMode()
  if (mode === 'off') return null
  const judge = async (): Promise<Verdict> => {
    const wanted = args.geminiStoreName
    if (wanted === null || wanted === undefined || wanted === '') return { refused: false } // nothing to write: the route writes nothing either
    if (!isSessionStoreName(wanted)) return { refused: true, reason: 'value_invalid', keys: ['geminiStoreName'] }
    const row = (args.existing && typeof args.existing === 'object' ? args.existing : {}) as Record<string, unknown>
    const held = typeof row.geminiStoreName === 'string' && row.geminiStoreName !== '' ? row.geminiStoreName : null
    if (held === wanted) return { refused: false }
    if (held !== null) return { refused: true, reason: 'store_immutable', keys: ['geminiStoreName'] }
    const elsewhere = await args.prisma.chatSession.findFirst({
      where: { userId: { not: args.userId }, OR: [{ geminiStoreName: wanted }, { geminiStoreId: wanted }] },
      select: { id: true },
    })
    if (elsewhere) return { refused: true, reason: 'store_recorded_elsewhere', keys: ['geminiStoreName'] }
    return { refused: false }
  }
  if (mode === 'shadow') {
    try {
      const verdict = await judge()
      if (verdict.refused) logRefusal('shadow', verdict.reason, verdict.keys)
    } catch {
      try { console.warn('[sessions files shadow] guard error') } catch { /* nothing */ }
    }
    return null
  }
  const verdict = await judge()
  if (verdict.refused) {
    logRefusal('enforce', verdict.reason, verdict.keys)
    return sessionPatchRefusal()
  }
  return null
}
