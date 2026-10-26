// FRONTEND-2: "Duplicate a deck", step 4: the Director adopts the copy into the copy's new session, so chat can edit it. Flag NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT (exact "true"), default off,
// read at build time; it acts only while the Duplicate-a-deck flag is on too. Director half: Director !561 (DIRECTOR_DUPLICATE_ADOPT_ENABLED), contract streams/director2/dup-adopt/CONTRACT.md.
//
// Without it the copy opens over its Layout deck, but the Director's session for the new id holds no deck, so every chat edit answers "we haven't started a presentation yet".
// With it, after the session PATCH (step 3) and before the copy is handed back to the deck list (so before anyone can open it):
//   4. the browser POSTs { presentation_id } to its own route, /api/director/sessions/{newSessionId}/adopt-duplicate (app/api/director/sessions/[sourceSessionId]/adopt-duplicate/route.ts), which
//      takes the user id from the login, signs it for the Director and forwards { user_id, presentation_id } to the Director. Final slot only: a strawman copy is an outline preview.
//      A failure never removes the copy or the new session (both are valid and in the person's list): the person reads DUPLICATE_ADOPT_PENDING_NOTE, and the call is retried at most twice while the
//      answer says `retryable: true`. A success writes a one-time receipt into the session's marker (copiedFrom.adoptedAt).
//   THE MARKER CARRIES THE COPY'S ID. Step 3 stores the copy's own presentation id in the copiedFrom marker (copiedFrom.presentationId, final slot, this flag on), and step 4 and the Builder-open backstop
//   ALWAYS adopt with that id. The session row's final slot is NOT trusted for it: the Director's connect makes a blank canvas for a session it has never seen, and the Builder writes that canvas's URL
//   into the row's final slot, so adopting with it would be NOT_A_DUPLICATE for good (DIRECTOR-2, 25 Oct). A copy made before this change has no presentationId in its marker: the backstop does nothing.
//   Builder open (the backstop): the Director socket reports "connected" (the hook's ws.onopen, for the socket's own session). The first time a session connects on this tab, the session row is read once; with a
//   copiedFrom marker that has a presentationId and NO adoptedAt receipt, the same route is called once (no retry here). On 200 the receipt is written; then, on reused false while that socket is still the live
//   one, the Director WebSocket reconnects (the live connection holds the session from before the deck). A copy adopted at duplicate time has the receipt and never calls again. At most one call per session
//   per tab: a reconnect's own "connected" is never acted on, so it cannot loop. A repeat call is safe anyway (the Director answers 200 reused:true from its stored receipt).
//
// Pure module: no React, no storage, no clock, no network of its own (the caller injects fetch, sleep and the time). It is browser-safe and never names the signing secret, the header or the minter: those are
// the route's alone.

import { readCopiedFrom } from '@/lib/studio-duplicate-deck'

export const STUDIO_DUPLICATE_ADOPT_FLAG = 'NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT'

/** A plain id, the Director's rule for {session_id} (contract section 2); the copy's presentation id is held to the same rule. */
export const DUPLICATE_ADOPT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/
/** The Director refuses a body over 4 KB; the Studio route refuses the browser's body over the same size. */
export const DUPLICATE_ADOPT_BODY_MAX_BYTES = 4096
/** How long the Studio route waits for the Director per attempt (an adoption reads the copy from Layout once: DIRECTOR-2 expects 1-3 s on UAT). A timeout is a retryable 502, and a repeat is safe (reused:true). */
export const DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS = 10_000
/** Step 4 retries: at most two more calls, and only while the answer says retryable. */
export const DUPLICATE_ADOPT_RETRY_DELAYS_MS = [1000, 2000] as const

export const DUPLICATE_ADOPT_PENDING_NOTE = "The copy is ready. Chat can't edit it yet; open it again in a moment."

/** The Studio route's own refusals (the Director's carry their own sentences). Same shape as the Director's: { error, code, detail, retryable }. */
export const DUPLICATE_ADOPT_WORDS = {
  REQUEST_INVALID: 'The copy could not be attached to chat: the request was not valid.',
  DIRECTOR_UNREACHABLE: 'Chat could not be reached. Try again in a moment.',
  DIRECTOR_BAD_RESPONSE: 'Chat gave an answer that could not be read. Try again in a moment.',
} as const

export interface DuplicateAdoptRefusal { error: string; code: string; detail: string; retryable: boolean }

export function duplicateAdoptRefusal(code: keyof typeof DUPLICATE_ADOPT_WORDS, retryable: boolean): DuplicateAdoptRefusal {
  return { error: DUPLICATE_ADOPT_WORDS[code], code, detail: DUPLICATE_ADOPT_WORDS[code], retryable }
}

export function isPlainAdoptId(value: unknown): value is string {
  return typeof value === 'string' && DUPLICATE_ADOPT_ID_RE.test(value)
}

/** The Studio route's own path for one session. */
export function duplicateAdoptPath(sessionId: string): string {
  return `/api/director/sessions/${encodeURIComponent(sessionId)}/adopt-duplicate`
}

/** The browser's body, as the Studio route accepts it: a JSON object whose ONLY key is presentation_id, a plain id. Anything else (another key, a user id, a URL) is refused. */
export function parseAdoptRequestBody(body: unknown): { ok: true; presentationId: string } | { ok: false } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false }
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== 'presentation_id') return { ok: false }
  const presentationId = (body as { presentation_id?: unknown }).presentation_id
  return isPlainAdoptId(presentationId) ? { ok: true, presentationId } : { ok: false }
}

/** What the Studio route sends the Director: exactly these two keys. `userId` is the login's id (the claim's sub), never the browser's. */
export function directorAdoptBody(userId: string, presentationId: string): string {
  return JSON.stringify({ user_id: userId, presentation_id: presentationId })
}

export interface DuplicateAdoptSuccess { ok: true; reused: boolean; attempts: number }
export interface DuplicateAdoptFailure { ok: false; status: number; code: string | null; retryable: boolean; attempts: number }
export type DuplicateAdoptOutcome = DuplicateAdoptSuccess | DuplicateAdoptFailure

export interface DuplicateAdoptDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  sleep: (ms: number) => Promise<void>
}

async function readJson(response: Response): Promise<any> {
  try { return await response.json() } catch { return null }
}

/**
 * Step 4: one call to the Studio route, and up to `retryDelaysMs.length` more while the answer is `retryable: true`. Never throws: a network failure is a retryable failure with status 0.
 * Only a 200 whose body says `status: "adopted"` is a success.
 */
export async function adoptDuplicateCopy({ sessionId, presentationId, fetch, sleep, retryDelaysMs = DUPLICATE_ADOPT_RETRY_DELAYS_MS }: {
  sessionId: string
  presentationId: string
  retryDelaysMs?: readonly number[]
} & DuplicateAdoptDeps): Promise<DuplicateAdoptOutcome> {
  let attempts = 0
  for (;;) {
    attempts += 1
    let outcome: DuplicateAdoptOutcome
    try {
      const response = await fetch(duplicateAdoptPath(sessionId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_id: presentationId }),
        cache: 'no-store',
      })
      const body = await readJson(response)
      if (response.ok && body?.status === 'adopted') return { ok: true, reused: body.reused === true, attempts }
      outcome = { ok: false, status: response.status, code: typeof body?.code === 'string' ? body.code : null, retryable: body?.retryable === true, attempts }
    } catch {
      outcome = { ok: false, status: 0, code: null, retryable: true, attempts }
    }
    const delay = retryDelaysMs[attempts - 1]
    if (!outcome.retryable || delay === undefined) return outcome
    try { await sleep(delay) } catch { return outcome }
  }
}

/** The one log line the Studio route writes, and only when the Director answers PRESENTATION_NOT_OWNED (DIRECTOR-2: the person owns no session whose deck is the one the copy was made from): the code, the NEW session's id
 *  and the presentation id that was sent, both held to the plain-id rule before they get here. Never the user id or email, the header, the body or any env value. */
export const DUPLICATE_ADOPT_NOT_OWNED_CODE = 'PRESENTATION_NOT_OWNED'
export function duplicateAdoptNotOwnedLine(sessionId: string, presentationId: string): string {
  return `[DUPLICATE_ADOPT] ${DUPLICATE_ADOPT_NOT_OWNED_CODE} session=${sessionId} presentation=${presentationId}`
}

/** The receipt's key inside the marker: an ISO time, written once, when the Director answered 200 for this copy. */
export const DUPLICATE_ADOPT_RECEIPT_KEY = 'adoptedAt'

export interface DuplicateAdoptMarker { presentationId: string | null; adoptedAt: string | null }

/**
 * What the copiedFrom marker (GET /api/sessions/{id} -> session.stateCache.currentStatus.copiedFrom) says about adoption: the copy's own id (null for a copy made before the marker carried it, and for a
 * strawman-slot copy) and the receipt (null until adopted). Null when the session is not a copy at all (the same test the copy's note uses).
 */
export function readAdoptMarker(session: unknown): DuplicateAdoptMarker | null {
  if (!readCopiedFrom(session)) return null
  const marker = (session as { stateCache: { currentStatus: { copiedFrom: { presentationId?: unknown; adoptedAt?: unknown } } } }).stateCache.currentStatus.copiedFrom
  return {
    presentationId: isPlainAdoptId(marker.presentationId) ? marker.presentationId : null,
    adoptedAt: typeof marker.adoptedAt === 'string' && marker.adoptedAt.trim() ? marker.adoptedAt : null,
  }
}

export type DuplicateAdoptReceiptResult = 'written' | 'already' | 'skipped' | 'failed'

/**
 * The one-time receipt: read the row, merge `adoptedAt` into the marker, PATCH it back. Read-modify-write on stateCache.currentStatus ONLY: the PATCH sends no slideStructure and no activeVersion, and
 * PATCH /api/sessions/{id} hands each absent key to Prisma as undefined, which leaves that column as it is, so a Builder autosave that landed in between (it writes those two columns and never currentStatus)
 * is not undone. Nothing else in currentStatus is dropped. Writes nothing when the row is not a copy, holds another id, or already has the receipt. Never throws.
 */
export async function recordAdoptReceipt({ sessionId, presentationId, fetch, now }: { sessionId: string; presentationId: string; fetch: DuplicateAdoptDeps['fetch']; now: () => Date }): Promise<DuplicateAdoptReceiptResult> {
  try {
    const rowPath = `/api/sessions/${encodeURIComponent(sessionId)}`
    const response = await fetch(rowPath, { cache: 'no-store' })
    if (!response.ok) return 'failed'
    const session = (await readJson(response))?.session
    const marker = readAdoptMarker(session)
    if (!marker || marker.presentationId !== presentationId) return 'skipped'
    if (marker.adoptedAt) return 'already'
    const status = session.stateCache.currentStatus as { copiedFrom: Record<string, unknown> }
    const patched = await fetch(rowPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateCache: { currentStatus: { ...status, copiedFrom: { ...status.copiedFrom, [DUPLICATE_ADOPT_RECEIPT_KEY]: now().toISOString() } } } }),
    })
    return patched.ok ? 'written' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Step 4 as the Decks page runs it: adopt (with retries), and on a 200 write the receipt, so the copy never calls again on open. The outcome is the adoption's; a receipt that could not be written changes nothing here. */
export async function adoptDuplicateCopyAndRecord({ now, ...input }: { sessionId: string; presentationId: string; retryDelaysMs?: readonly number[]; now: () => Date } & DuplicateAdoptDeps): Promise<DuplicateAdoptOutcome> {
  const outcome = await adoptDuplicateCopy(input)
  if (outcome.ok) await recordAdoptReceipt({ sessionId: input.sessionId, presentationId: input.presentationId, fetch: input.fetch, now })
  return outcome
}

export interface DuplicateAdoptSocketOwner { sessionId: string; isCurrent: () => boolean }
export type DuplicateAdoptOpenResult = 'not-first' | 'not-a-copy' | 'no-copy-id' | 'already-adopted' | 'reconnected' | 'not-current' | 'reused' | 'failed'

/**
 * Builder open. One controller per tab: `onConnected` is told each time the Director socket of a session reports connected, and acts on the FIRST one of each session only (a reconnect's own
 * "connected", or any later one, is never acted on, so it cannot loop). It reads the session row once, and calls the Studio route once (no retry here) only for a copy whose marker has a presentationId and no
 * receipt. On 200 it writes the receipt, then calls `reconnect` only when reused is false while that socket is still the live one. Never throws.
 */
export function createDuplicateAdoptOnOpen(deps: { fetch: DuplicateAdoptDeps['fetch']; now: () => Date }) {
  const seen = new Set<string>()
  const onConnected = async (owner: DuplicateAdoptSocketOwner, reconnect: () => void): Promise<DuplicateAdoptOpenResult> => {
    try {
      const sessionId = owner?.sessionId
      if (typeof sessionId !== 'string' || !sessionId || seen.has(sessionId)) return 'not-first'
      seen.add(sessionId)
      if (!isPlainAdoptId(sessionId)) return 'not-a-copy'
      let session: unknown = null
      try {
        const response = await deps.fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
        session = response.ok ? (await readJson(response))?.session ?? null : null
      } catch {
        session = null
      }
      const marker = readAdoptMarker(session)
      if (!marker) return 'not-a-copy'
      if (!marker.presentationId) return 'no-copy-id'
      if (marker.adoptedAt) return 'already-adopted'
      const outcome = await adoptDuplicateCopy({ sessionId, presentationId: marker.presentationId, fetch: deps.fetch, sleep: async () => {}, retryDelaysMs: [] })
      if (!outcome.ok) return 'failed'
      await recordAdoptReceipt({ sessionId, presentationId: marker.presentationId, fetch: deps.fetch, now: deps.now })
      if (outcome.reused) return 'reused'
      if (!owner.isCurrent()) return 'not-current'
      reconnect()
      return 'reconnected'
    } catch {
      return 'failed'
    }
  }
  return { onConnected }
}
