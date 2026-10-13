/**
 * PASS2 #8: error / loading / session hygiene for the Studio Builder.
 *
 * Flag NEXT_PUBLIC_STUDIO_SESSION_HYGIENE (exact "true", default off). Off, nothing in this module is consulted and
 * the Builder, the route loader and the 404 page are exactly as before. On:
 *
 *  1. A bare /builder (or ?session_id=new) is a local, unsaved session. No history row is written for it until the
 *     user's first real action (first message, an upload, a manual-deck handoff: the paths that already create the row).
 *     A reload of that URL does not create the row either.
 *  2. /builder?session_id=<id> for an id the account does not have is an error state ("session not found"), never a
 *     silently created empty session. A deleted session and a failed lookup get their own wording.
 *  3. The route loader is the Builder shell skeleton instead of a blank page (components/builder/studio-session-hygiene).
 *  4. Unknown routes get a styled not-found page (app/not-found.tsx).
 *
 * Pure policy only: no React, no network, no globals but the injected storage. The Next build inlines the flag below.
 */
import { unsavedBuilderSessionKey } from '@/lib/last-builder-session'

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_SESSION_HYGIENE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true'

/** Outcome of asking the frontend history for one session row. Never throws. */
export type SessionLoadOutcome<TSession = unknown> =
  | { kind: 'found'; session: TSession }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'gone' }
  | { kind: 'error'; status?: number }

/** A lookup that produced no usable row. */
export type SessionLoadFailure = Exclude<SessionLoadOutcome, { kind: 'found' }>

/** GET /api/sessions/[id] status -> failure kind. 200 is handled by the caller (it still has to parse the body). */
export function sessionLoadKindForStatus(status: number): SessionLoadFailure['kind'] {
  if (status === 404) return 'not_found'
  if (status === 403) return 'forbidden'
  if (status === 410) return 'gone'
  return 'error'
}

/** What the Builder shows instead of the workspace. */
export type StudioSessionProblem = 'not_found' | 'deleted' | 'load_error'

/** What to do when the history has no usable row for the URL's session id. */
export type MissingSessionDecision =
  | 'keep_unsaved' // a local id this tab made: stay unsaved, write nothing
  | 'adopt' // today's behaviour: create the row for the URL id (staged hand-off flows only)
  | StudioSessionProblem

/** Marker families that prove a hand-off flow staged this id in this tab (each creates its row first, but a write race can 404 the first read). */
export const STAGED_HANDOFF_KEY_PREFIXES = [
  'deckster_composer_ready_', // lib/composer-library.ts COMPOSER_READY_KEY_PREFIX
  'deckster_ingest_intent_', // hooks/use-deckster-websocket-v2.ts INGEST_INTENT_KEY_PREFIX
  'deckster_ingest_job_', // hooks/use-deckster-websocket-v2.ts INGEST_JOB_KEY_PREFIX
  'deckster_pending_handoff_', // lib/manual-deck-workflow.ts pendingHandoffStorageKey
] as const

export interface SessionOrigin {
  /** This tab generated the id locally and has not written a row for it (sessionStorage marker). */
  unsavedMarker: boolean
  /** A hand-off flow staged this id in this tab. */
  stagedHandoff: boolean
}

interface StorageLike { getItem(key: string): string | null }

/** Reads the two local proofs that an id is legitimately new. Storage that throws is "no proof". */
export function readSessionOrigin(storage: StorageLike | null | undefined, ownerId: string, sessionId: string): SessionOrigin {
  const has = (key: string) => {
    try { return Boolean(storage?.getItem(key)) } catch { return false }
  }
  let unsavedMarker = false
  try { unsavedMarker = Boolean(ownerId) && storage?.getItem(unsavedBuilderSessionKey(ownerId, sessionId)) === 'true' } catch { /* no proof */ }
  return {
    unsavedMarker,
    stagedHandoff: STAGED_HANDOFF_KEY_PREFIXES.some(prefix => has(`${prefix}${sessionId}`)),
  }
}

/**
 * The single decision table. Only called when the lookup did not return a usable row.
 *  - 404 + a local unsaved id          -> keep it unsaved (the Builder's own "new presentation").
 *  - 404 + a staged hand-off           -> adopt, as before (the flow needs its row).
 *  - 404 / 403 otherwise               -> "not found" (a foreign id reads exactly like a missing one).
 *  - 410                               -> "deleted".
 *  - anything else (network, 5xx, 401) -> "could not load": never turned into a new empty session.
 */
export function decideMissingSession(outcome: SessionLoadFailure, origin: SessionOrigin): MissingSessionDecision {
  switch (outcome.kind) {
    case 'not_found':
      if (origin.unsavedMarker) return 'keep_unsaved'
      if (origin.stagedHandoff) return 'adopt'
      return 'not_found'
    case 'forbidden': return 'not_found'
    case 'gone': return 'deleted'
    case 'error': return 'load_error'
  }
}

/** True when the "last builder session" shortcut must not point at this session (an unsaved id has no row to open). */
export function shouldRememberLastSession(hygiene: boolean, isUnsavedSession: boolean): boolean {
  return !(hygiene && isUnsavedSession)
}

export interface StudioSessionProblemCopy {
  eyebrow: string
  title: string
  body: string
}

/** Plain words, Studio voice. Nothing here claims more than is known. */
export const STUDIO_SESSION_PROBLEM_COPY: Record<StudioSessionProblem, StudioSessionProblemCopy> = {
  not_found: {
    eyebrow: 'Session not found',
    title: 'We couldn’t find this session.',
    body: 'The link may be old, the session may have been deleted, or it may belong to another account. Nothing was created or changed.',
  },
  deleted: {
    eyebrow: 'Session deleted',
    title: 'This session was deleted.',
    body: 'It is no longer in your history, so there is nothing to open here. Nothing was created or changed.',
  },
  load_error: {
    eyebrow: 'Couldn’t load the session',
    title: 'We couldn’t open this session just now.',
    body: 'Something went wrong while reaching your history. Nothing was created or changed, and your decks are safe. Try again in a moment.',
  },
}

/** Where the error state sends people. Plain anchors: a full load resets every in-memory builder state. */
export const STUDIO_SESSION_PROBLEM_LINKS = {
  newPresentation: '/builder?session_id=new',
  decks: '/dashboard',
} as const
