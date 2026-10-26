// FRONTEND-2: "Duplicate a deck", step 4: the Director adopts the copy into the copy's new session, so chat can edit it. Flag NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT (exact "true"), default off,
// read at build time; it acts only while the Duplicate-a-deck flag is on too. Director half: Director !561 (DIRECTOR_DUPLICATE_ADOPT_ENABLED), contract streams/director2/dup-adopt/CONTRACT.md.
//
// Without it the copy opens over its Layout deck, but the Director's session for the new id holds no deck, so every chat edit answers "we haven't started a presentation yet".
// With it, after the session PATCH (step 3) and before the copy is handed back to the deck list (so before anyone can open it):
//   4. the browser POSTs { presentation_id } to its own route, /api/director/sessions/{newSessionId}/adopt-duplicate (app/api/director/sessions/[sourceSessionId]/adopt-duplicate/route.ts), which
//      takes the user id from the login, signs it for the Director and forwards { user_id, presentation_id } to the Director. Final slot only: a strawman copy is an outline preview.
//      A failure never removes the copy or the new session (both are valid and in the person's list): the person reads DUPLICATE_ADOPT_PENDING_NOTE, and the call is retried at most twice while the
//      answer says `retryable: true`.
//   Builder open: a copy that was never adopted is adopted when it is opened. The first sync_response of the session on this tab names no deck (no presentation_id, or has_strawman false) and the
//   session carries the copiedFrom marker: the same route is called once, and on 200 with reused false the Director WebSocket reconnects (the live connection holds the session from before the deck).
//
// Pure module: no React, no storage, no clock, no network of its own (the caller injects fetch and sleep). It is browser-safe and never names the signing secret, the header or the minter: those are
// the route's alone.

import { readCopiedFrom } from '@/lib/studio-duplicate-deck'

export const STUDIO_DUPLICATE_ADOPT_FLAG = 'NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT'

/** A plain id, the Director's rule for {session_id} (contract section 2); the copy's presentation id is held to the same rule. */
export const DUPLICATE_ADOPT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/
/** The Director refuses a body over 4 KB; the Studio route refuses the browser's body over the same size. */
export const DUPLICATE_ADOPT_BODY_MAX_BYTES = 4096
/** How long the Studio route waits for the Director (an adoption reads the copy from Layout once). */
export const DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS = 30_000
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

/** Builder open: the first sync_response names no deck the Director holds for this session (no presentation_id, or has_strawman false). */
export function syncNamesNoDeck(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const { presentation_id: presentationId, has_strawman: hasStrawman } = payload as { presentation_id?: unknown; has_strawman?: unknown }
  return !(typeof presentationId === 'string' && presentationId.trim()) || hasStrawman === false
}

/** The copy's deck id from GET /api/sessions/{id}: the final slot's id the duplicate stored (null for a strawman-slot copy, which is never adopted). */
export function finalCopyIdOf(session: unknown): string | null {
  const id = (session as { finalPresentationId?: unknown } | null | undefined)?.finalPresentationId
  return isPlainAdoptId(id) ? id : null
}

export interface DuplicateAdoptSyncOwner { sessionId: string; isCurrent: () => boolean }
export type DuplicateAdoptOpenResult = 'not-first' | 'has-deck' | 'not-a-copy' | 'not-final' | 'reconnected' | 'not-current' | 'reused' | 'failed'

/**
 * Builder open. One controller per tab: `onSync` is given each sync_response payload of the socket's own session, and acts on the FIRST one of each session only (a reconnect's next
 * sync_response, or a later one, is never acted on, so it cannot loop). It reads the session row once (the copiedFrom marker and the final slot's id), calls the Studio route once (no retry
 * here), and calls `reconnect` only on 200 with reused false while that socket is still the live one. Never throws; nothing is written by Studio.
 */
export function createDuplicateAdoptOnOpen(deps: { fetch: DuplicateAdoptDeps['fetch'] }) {
  const seen = new Set<string>()
  const onSync = async (payload: unknown, owner: DuplicateAdoptSyncOwner, reconnect: () => void): Promise<DuplicateAdoptOpenResult> => {
    try {
      const sessionId = owner?.sessionId
      if (typeof sessionId !== 'string' || !sessionId || seen.has(sessionId)) return 'not-first'
      seen.add(sessionId)
      if (!syncNamesNoDeck(payload)) return 'has-deck'
      if (!isPlainAdoptId(sessionId)) return 'not-a-copy'
      let session: unknown = null
      try {
        const response = await deps.fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
        session = response.ok ? (await readJson(response))?.session ?? null : null
      } catch {
        session = null
      }
      if (!readCopiedFrom(session)) return 'not-a-copy'
      const copyId = finalCopyIdOf(session)
      if (!copyId) return 'not-final'
      const outcome = await adoptDuplicateCopy({ sessionId, presentationId: copyId, fetch: deps.fetch, sleep: async () => {}, retryDelaysMs: [] })
      if (!outcome.ok) return 'failed'
      if (outcome.reused) return 'reused'
      if (!owner.isCurrent()) return 'not-current'
      reconnect()
      return 'reconnected'
    } catch {
      return 'failed'
    }
  }
  return { onSync }
}
