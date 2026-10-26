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
//   Builder open (the backstop): the Director socket reports "connected" (the hook's ws.onopen, for the socket's own session), and that ARMS the session. The call is NOT made on open: for a session the
//   Director has never seen, the connect first makes a blank canvas (Layout create plus theme, a few seconds) and only then writes the session's deck pointer, with no re-read and no lock, so an
//   adoption that landed in that window would be overwritten by the blank (DIRECTOR-2, websocket.py new-session branch, _create_and_send_blank_presentation). That branch always sends the blank
//   presentation_init and then the greeting (a plain chat_message), after the write. So the backstop fires on whichever comes first: (a) the first Director chat_message for this session on this socket, or
//   (b) DUPLICATE_ADOPT_GREETING_WAIT_MS (15 s) after connected with no chat_message (the branch has finished or failed by then). Armed means: the session row was read once and its copiedFrom marker has a
//   presentationId and NO adoptedAt receipt. Then the same route is called once (no retry here). On 200 the receipt is written; then, on reused false while that socket is still the live one, the Director
//   WebSocket reconnects (the live connection holds the session from before the deck). The timer is cancelled when the socket closes (any socket, stale or not, by the owner it was armed with) or is no
//   longer current. A copy adopted at duplicate time has the receipt and is never armed. At most one call per session per tab: once a session's call is made, a reconnect's own connected arms nothing, and
//   its greeting or timer fires nothing; greeting and timer racing make one call. A repeat call is safe anyway (the Director answers 200 reused:true from its stored receipt).
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

/** The backstop waits this long after connected for the Director's first chat_message (the greeting) before it calls anyway: the new-session branch has finished or failed by then. */
export const DUPLICATE_ADOPT_GREETING_WAIT_MS = 15_000

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

/** What the hook tells the caller about one socket. The owner object is made once per socket: its identity is how a timer is cancelled for the right socket. */
export type DuplicateAdoptSocketEvent = 'connected' | 'chat' | 'closed'
export interface DuplicateAdoptSocketOwner { sessionId: string; isCurrent: () => boolean }
export type DuplicateAdoptOpenResult = 'not-first' | 'not-a-copy' | 'no-copy-id' | 'already-adopted' | 'reconnected' | 'not-current' | 'reused' | 'failed' | 'cancelled'

/**
 * Builder open. One controller per tab, driven by what the hook tells it about each socket (see the header). `onConnected` arms a session and returns a promise that settles when that socket's arming ends:
 * with the call's outcome, or without a call ('not-first' when the session was already called or is known not to need it, 'not-a-copy', 'no-copy-id', 'already-adopted', 'cancelled' on close, 'not-current').
 * `schedule(run, ms)` starts a timer and returns its cancel function (injected: this module has no clock). Never throws; nothing is written by Studio except the receipt.
 */
export function createDuplicateAdoptOnOpen(deps: { fetch: DuplicateAdoptDeps['fetch']; now: () => Date; schedule: (run: () => void, ms: number) => () => void }) {
  const called = new Set<string>() // sessions whose one call has been started on this tab
  const settled = new Set<string>() // sessions known not to need one (not a copy, no id in the marker, receipt present): never read again
  interface Entry { presentationId: string | null; greeted: boolean; waited: boolean; firing: boolean; ended: boolean; cancelTimer: (() => void) | null; settle: (result: DuplicateAdoptOpenResult) => void; fire: () => void }
  const entries = new Map<DuplicateAdoptSocketOwner, Entry>()

  const end = (owner: DuplicateAdoptSocketOwner, entry: Entry, result: DuplicateAdoptOpenResult) => {
    if (entry.ended) return
    entry.ended = true
    try { entry.cancelTimer?.() } catch { /* a timer that cannot be cancelled has nothing left to do */ }
    entry.cancelTimer = null
    entries.delete(owner)
    entry.settle(result)
  }

  const onConnected = (owner: DuplicateAdoptSocketOwner, reconnect: () => void): Promise<DuplicateAdoptOpenResult> => new Promise<DuplicateAdoptOpenResult>(settle => {
    try {
      const sessionId = owner?.sessionId
      if (typeof sessionId !== 'string' || !sessionId || called.has(sessionId) || settled.has(sessionId) || entries.has(owner)) return settle('not-first')
      if (!isPlainAdoptId(sessionId)) return settle('not-a-copy')
      const entry: Entry = { presentationId: null, greeted: false, waited: false, firing: false, ended: false, cancelTimer: null, settle, fire: () => {} }
      entries.set(owner, entry)

      const run = async () => {
        try {
          const outcome = await adoptDuplicateCopy({ sessionId, presentationId: entry.presentationId as string, fetch: deps.fetch, sleep: async () => {}, retryDelaysMs: [] })
          if (!outcome.ok) return end(owner, entry, 'failed')
          await recordAdoptReceipt({ sessionId, presentationId: entry.presentationId as string, fetch: deps.fetch, now: deps.now })
          if (outcome.reused) return end(owner, entry, 'reused')
          if (!owner.isCurrent()) return end(owner, entry, 'not-current')
          reconnect()
          return end(owner, entry, 'reconnected')
        } catch {
          return end(owner, entry, 'failed')
        }
      }
      // Fires on the first of: the greeting (a chat_message on this socket) or the wait, once the row says this is a copy to adopt. Marking the session called BEFORE the call is what makes a race
      // between the greeting and the timer, or a second socket for the same session, one call.
      const maybeFire = () => {
        if (entry.ended || entry.firing || !entry.presentationId || !(entry.greeted || entry.waited)) return
        if (called.has(sessionId)) return end(owner, entry, 'not-first')
        if (!owner.isCurrent()) return end(owner, entry, 'not-current')
        entry.firing = true
        called.add(sessionId)
        try { entry.cancelTimer?.() } catch { /* nothing left to do */ }
        entry.cancelTimer = null
        void run()
      }
      entry.fire = maybeFire
      try {
        entry.cancelTimer = deps.schedule(() => { entry.cancelTimer = null; entry.waited = true; maybeFire() }, DUPLICATE_ADOPT_GREETING_WAIT_MS)
      } catch {
        entry.cancelTimer = null
      }
      void (async () => {
        try {
          let session: unknown = null, rowRead = false
          try {
            const response = await deps.fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
            session = response.ok ? (await readJson(response))?.session ?? null : null
            rowRead = response.ok
          } catch {
            session = null
          }
          if (entry.ended) return
          const marker = readAdoptMarker(session)
          const verdict: DuplicateAdoptOpenResult | null = !marker ? 'not-a-copy' : !marker.presentationId ? 'no-copy-id' : marker.adoptedAt ? 'already-adopted' : null
          if (verdict) { if (rowRead) settled.add(sessionId); return end(owner, entry, verdict) } // a row that could not be read is not a verdict: the next connected may read it again
          entry.presentationId = marker?.presentationId ?? null
          maybeFire()
        } catch {
          end(owner, entry, 'failed')
        }
      })()
    } catch {
      settle('failed')
    }
  })

  /** The Director sent a chat_message for this socket's session: on the new-session branch that is the greeting, which comes after the blank canvas's row write. */
  const onChat = (owner: DuplicateAdoptSocketOwner): void => {
    const entry = entries.get(owner)
    if (!entry || entry.ended) return
    entry.greeted = true
    entry.fire()
  }

  /** The socket closed (any socket, stale or not): its timer goes. A call already started is left to finish. */
  const onClosed = (owner: DuplicateAdoptSocketOwner): void => {
    const entry = entries.get(owner)
    if (!entry || entry.firing) return
    end(owner, entry, 'cancelled')
  }

  /** The one entry the Builder wires to the hook's callback. */
  const onSocketEvent = (event: DuplicateAdoptSocketEvent, owner: DuplicateAdoptSocketOwner, reconnect: () => void): Promise<DuplicateAdoptOpenResult | void> => {
    if (event === 'connected') return onConnected(owner, reconnect)
    if (event === 'chat') onChat(owner)
    else if (event === 'closed') onClosed(owner)
    return Promise.resolve()
  }
  return { onConnected, onChat, onClosed, onSocketEvent }
}
