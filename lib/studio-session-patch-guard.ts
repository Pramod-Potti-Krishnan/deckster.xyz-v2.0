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

/** Thrown inside a transaction to roll it back with a reason the guard answers uniformly (never sent to the browser). */
class StoreRefusal extends Error {
  readonly reason: SessionPatchReason
  constructor(reason: SessionPatchReason) { super(reason); this.reason = reason }
}

interface TxClient {
  chatSession: {
    findFirst(args: unknown): Promise<unknown>
    updateMany(args: unknown): Promise<{ count: number }>
  }
  uploadedFile: { create(args: unknown): Promise<unknown> }
}
interface StorePrisma extends GuardPrisma {
  $transaction?: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>
}

/** The uploaded-file row exactly as the files route creates it (it is created here, inside the same transaction as the store binding, in enforce mode). */
export interface SessionFileData {
  sessionId: string
  userId: string
  fileName: string
  fileSize: number
  fileType: string
  geminiFileUri: string
  geminiFileName: string | null
  geminiStoreName: string | null
  uploadStatus: string
  uploadError: string | null
}

/**
 * POST /api/sessions/[id]/files, called after the ownership check, the body parse and the missing-metadata check, before anything is created. The browser persists
 * the knowledge store name through this route, so the store is accepted when it is well formed, when the row has none yet or already holds exactly this name, and
 * when no other user's session records it.
 *   off:     null at once (the route's own legacy write follows).
 *   shadow:  the same judgement on the row as read, only logged; null (the legacy write follows).
 *   enforce: with a non-empty store name, ONE transaction does everything: the cross-user check, a conditional first bind of the session (an updateMany that only matches a
 *            row with no store yet), or else an idempotent touch that only matches a row already holding exactly this name (a distinct store id the upload route set is
 *            kept), and only when one of the two matched, the uploaded-file row. Any failure rolls both back (no file, no session write). A client without $transaction
 *            fails closed. Returns the route's own answer ({ file }) or the one uniform refusal. With no store name there is nothing to bind: null (the legacy file write).
 */
export async function guardSessionStoreWrite(args: {
  mode?: SessionPatchMode
  prisma: StorePrisma
  userId: string
  sessionId: string
  existing: unknown
  geminiStoreName: unknown
  file: SessionFileData
}): Promise<NextResponse | null> {
  const mode = args.mode ?? sessionPatchMode()
  if (mode === 'off') return null
  const wanted = args.geminiStoreName
  const nothingToBind = wanted === null || wanted === undefined || wanted === ''
  if (mode === 'shadow') {
    try {
      const verdict = await judgeStoreAsRead(args)
      if (verdict.refused) logRefusal('shadow', verdict.reason, verdict.keys)
    } catch {
      try { console.warn('[sessions files shadow] guard error') } catch { /* nothing */ }
    }
    return null
  }
  // enforce: nothing in here is allowed to turn into a pass
  if (nothingToBind) return null
  if (!isSessionStoreName(wanted)) {
    logRefusal('enforce', 'value_invalid', ['geminiStoreName'])
    return sessionPatchRefusal()
  }
  const run = args.prisma.$transaction
  if (typeof run !== 'function') throw new Error('transactions are unavailable')
  try {
    const file = await run.call(args.prisma, async (tx: TxClient) => {
      const elsewhere = await tx.chatSession.findFirst({
        where: { userId: { not: args.userId }, OR: [{ geminiStoreName: wanted }, { geminiStoreId: wanted }] },
        select: { id: true },
      })
      if (elsewhere) throw new StoreRefusal('store_recorded_elsewhere')
      const now = new Date()
      const bound = await tx.chatSession.updateMany({
        where: { id: args.sessionId, userId: args.userId, OR: [{ geminiStoreName: null }, { geminiStoreName: '' }] },
        data: { geminiStoreName: wanted, geminiStoreId: wanted, updatedAt: now },
      })
      if (bound.count !== 1) {
        const same = await tx.chatSession.updateMany({ where: { id: args.sessionId, userId: args.userId, geminiStoreName: wanted }, data: { updatedAt: now } })
        if (same.count !== 1) throw new StoreRefusal('store_immutable')
      }
      return tx.uploadedFile.create({ data: args.file })
    })
    return NextResponse.json({ file })
  } catch (error) {
    if (error instanceof StoreRefusal) {
      logRefusal('enforce', error.reason, ['geminiStoreName'])
      return sessionPatchRefusal()
    }
    throw error // anything else was rolled back; the route's own error answer follows and nothing was written
  }
}

/** The shadow judgement of the store write, on the row as the route read it (no transaction; only logged). */
async function judgeStoreAsRead(args: { prisma: StorePrisma; userId: string; existing: unknown; geminiStoreName: unknown }): Promise<Verdict> {
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

/**
 * POST /api/upload, called when it has just created a Knowledge Service session for a chat that has no store yet, before the route's own session update. Off and shadow
 * return null (the route's legacy update follows). Enforce binds the new store with a conditional first bind (it only matches a row with no store yet); when that matched
 * nothing, someone else bound first: the winning binding is read back and returned so the route adopts it (its own update then restates the same values), and a missing
 * binding fails closed. /api/upload can therefore never overwrite a winning binding.
 */
export async function guardUploadStoreBind(args: {
  mode?: SessionPatchMode
  prisma: { chatSession: { updateMany(args: unknown): Promise<{ count: number }>; findFirst(args: unknown): Promise<unknown> } }
  userId: string
  sessionId: string
  storeName: string | null
  storeId: string | null
}): Promise<{ storeName: string; storeId: string } | null> {
  const mode = args.mode ?? sessionPatchMode()
  if (mode !== 'enforce') return null
  if (typeof args.storeName !== 'string' || args.storeName === '') throw new Error('no store to bind')
  const bound = await args.prisma.chatSession.updateMany({
    where: { id: args.sessionId, userId: args.userId, OR: [{ geminiStoreName: null }, { geminiStoreName: '' }] },
    data: { geminiStoreName: args.storeName, geminiStoreId: args.storeId },
  })
  if (bound.count === 1) return { storeName: args.storeName, storeId: typeof args.storeId === 'string' ? args.storeId : args.storeName }
  const row = (await args.prisma.chatSession.findFirst({ where: { id: args.sessionId, userId: args.userId }, select: { geminiStoreName: true, geminiStoreId: true } })) as { geminiStoreName?: string | null; geminiStoreId?: string | null } | null
  if (!row || typeof row.geminiStoreName !== 'string' || row.geminiStoreName === '') throw new Error('the store binding could not be confirmed')
  return { storeName: row.geminiStoreName, storeId: typeof row.geminiStoreId === 'string' && row.geminiStoreId !== '' ? row.geminiStoreId : row.geminiStoreName }
}
