// FRONTEND-2, Pass 3: "Duplicate a deck", the Studio half. Flag NEXT_PUBLIC_STUDIO_DUPLICATE_DECK (exact "true"), default off, read at build time.
//
// The deck list's "Duplicate" item is disabled today. With the flag on it copies a deck in three steps, in this order:
//   1. Layout copies the whole presentation: POST {layout}/api/presentations/{id}/duplicate  { operation_id, title }   (layout-builder-v7.5 !244, itself behind
//      LAYOUT_PRESENTATION_DUPLICATE_ENABLED: Layout answers 404 while that is off). The reply is merge's shape: { success, id, presentation_id, url: "/p/{id}",
//      presentation_url: "/p/{id}", slide_count, reused }, the URLs RELATIVE, so the absolute viewer URL is built here from the Layout base URL.
//   2. POST /api/sessions { sessionId, title }       a new session row (stage 1, so it is not listed until step 3).
//   3. PATCH /api/sessions/{id}                      the copy's URL and id in the slot the source used (final or strawman), currentStage, slideCount,
//                                                    lastMessageAt (so the 7-day "empty session" filter never hides an unopened copy), and the durable marker
//                                                    stateCache.currentStatus.copiedFrom = { sessionId, title }.
// Chat history is NOT copied (ChatMessage.id is the global WS message_id). If step 2 or 3 fails the new session is soft-deleted (DELETE /api/sessions/{id}) and the
// person is told "The copy could not be finished." plus that a stray Layout copy may remain (the client cannot delete a Layout deck by id). If step 1 fails nothing
// was created anywhere.
//
// WHY THE MARKER LIVES IN stateCache.currentStatus: PATCH /api/sessions/{id} stores exactly three stateCache columns (currentStatus, slideStructure, activeVersion)
// and drops every other key. slideStructure and activeVersion are rewritten by the Builder (use-builder-session's onSessionStateChange), so they cannot carry a
// durable marker; currentStatus (a Json column, "last StatusUpdate payload") is never written or read from the database by the Builder, so the marker stays.
//
// Pure module: no React, no storage, no clock of its own, no network of its own. The caller injects fetch, the Layout base URL, the id source, the clock and sleep.

export const STUDIO_DUPLICATE_DECK_FLAG = 'NEXT_PUBLIC_STUDIO_DUPLICATE_DECK'

export const COPY_TITLE_SUFFIX = ' (copy)'
/** Layout's PresentationDuplicateRequest.title is 1..200 characters. */
export const LAYOUT_TITLE_MAX = 200
/** The existing hook (use-chat-sessions updateSession) retries a PATCH that 404s right after the row was created (a write race); this does the same. */
export const PATCH_RETRY_DELAYS_MS = [400, 800, 1200] as const

export const NOTE_COPIED_FROM_SENTENCE = 'Chat history stays with the original.'
export const COPY_UNFINISHED_MESSAGE = 'The copy could not be finished.'
export const COPY_STRAY_NOTE = 'A stray copy of the deck may remain in storage; it cannot be removed from here.'
export const COPY_SESSION_NOT_REMOVED_NOTE = 'The unfinished copy session could not be removed either; check your session history.'

export const DUPLICATE_BLOCKED = {
  noDeck: 'Duplicate needs a saved deck; this session has none yet.',
  otherEnvironment: 'Duplicate is unavailable: this deck is stored in another environment.',
  noId: 'Duplicate is unavailable: this deck’s link has no presentation id.',
} as const

export const LAYOUT_FAILURE_MESSAGE = {
  unavailable: 'Duplicating decks is not available in this environment yet. Nothing was created.',
  source_missing: 'The original deck could not be found in Layout. Nothing was created.',
  unreachable: 'Layout could not be reached, so the deck was not copied. Nothing was created.',
  not_configured: 'Layout is not set up in this environment, so the deck was not copied. Nothing was created.',
  failed: 'Layout could not copy the deck. Nothing was created.',
} as const

export type LayoutFailureReason = keyof typeof LAYOUT_FAILURE_MESSAGE
export type DeckSlot = 'final' | 'strawman'

export interface DuplicateTargetOk { ok: true; slot: DeckSlot; presentationId: string; url: string }
export interface DuplicateTargetBlocked { ok: false; reason: string }
export type DuplicateTarget = DuplicateTargetOk | DuplicateTargetBlocked

export interface ViewerUrlDecision { status: string; url?: string | null }

/**
 * Which Layout deck a list card stands for, and whether it may be copied. The slot is the one the card previews: the final deck when the session has one, else the
 * strawman (outline preview). The id is read from the viewer URL (the list endpoint does not select the strawman/final presentation ids). A URL the Layout viewer
 * policy does not allow (another environment's Layout) is not copied.
 */
export function duplicateTargetFor(
  source: { finalPresentationUrl?: string | null; strawmanPreviewUrl?: string | null },
  evaluate: (url: string) => ViewerUrlDecision,
): DuplicateTarget {
  const slot: DeckSlot | null = source.finalPresentationUrl ? 'final' : source.strawmanPreviewUrl ? 'strawman' : null
  if (!slot) return { ok: false, reason: DUPLICATE_BLOCKED.noDeck }
  const candidate = (slot === 'final' ? source.finalPresentationUrl : source.strawmanPreviewUrl) as string
  const decision = evaluate(candidate)
  if (decision.status !== 'allowed' || typeof decision.url !== 'string') return { ok: false, reason: DUPLICATE_BLOCKED.otherEnvironment }
  const presentationId = presentationIdFromUrl(decision.url)
  if (!presentationId) return { ok: false, reason: DUPLICATE_BLOCKED.noId }
  return { ok: true, slot, presentationId, url: decision.url }
}

/** Same rule as lib/builder-presentation-ownership.presentationIdFromViewerUrl: the segment after the last "p" in the path. */
export function presentationIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const marker = parts.lastIndexOf('p')
    const id = marker >= 0 && parts[marker + 1] ? decodeURIComponent(parts[marker + 1]) : ''
    return id.trim() || null
  } catch {
    return null
  }
}

/** "<title> (copy)", never longer than Layout accepts (the title is cut by whole characters and ends with an ellipsis when it had to be). */
export function duplicateTitle(shownTitle: string): string {
  const base = (typeof shownTitle === 'string' ? shownTitle.trim() : '') || 'Untitled Presentation'
  const room = LAYOUT_TITLE_MAX - COPY_TITLE_SUFFIX.length
  const chars = Array.from(base)
  const cut = chars.length > room ? `${chars.slice(0, room - 1).join('').trimEnd()}…` : base
  return `${cut}${COPY_TITLE_SUFFIX}`
}

export interface CopiedFrom { sessionId: string; title: string }

/** The marker as the Builder reads it back: GET /api/sessions/{id} -> { session: { stateCache: { currentStatus: { copiedFrom: { sessionId, title } } } } }. */
export function readCopiedFrom(session: unknown): CopiedFrom | null {
  const cache = (session as { stateCache?: unknown } | null | undefined)?.stateCache
  const status = (cache as { currentStatus?: unknown } | null | undefined)?.currentStatus
  const marker = (status as { copiedFrom?: unknown } | null | undefined)?.copiedFrom as { sessionId?: unknown; title?: unknown } | null | undefined
  if (!marker || typeof marker !== 'object') return null
  const sessionId = typeof marker.sessionId === 'string' ? marker.sessionId.trim() : ''
  const title = typeof marker.title === 'string' ? marker.title.trim() : ''
  return sessionId && title ? { sessionId, title } : null
}

/** The one line shown in the copy's chat. */
export function copiedFromLine(title: string): string {
  return `Copied from ${title}. ${NOTE_COPIED_FROM_SENTENCE}`
}

/** Reads the marker for one session. Never throws and never writes: any failure (offline, 401, 404 for an unsaved session, a bad body) is "no marker". */
export async function loadCopiedFrom(
  sessionId: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
  signal?: AbortSignal,
): Promise<CopiedFrom | null> {
  try {
    const response = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store', ...(signal ? { signal } : {}) })
    if (!response.ok) return null
    const body = await response.json()
    return readCopiedFrom(body?.session)
  } catch {
    return null
  }
}

export interface DuplicateDeckDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  /** Layout's base URL (getLayoutServiceUrl); throws when it is not configured. */
  layoutBaseUrl: () => string
  /** A fresh uuid for each call (crypto.randomUUID). */
  newId: () => string
  now: () => Date
  sleep: (ms: number) => Promise<void>
  /** DUPLICATE-ADOPT (NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT): step 4, the Director adopts the copy into the new session (lib/studio-duplicate-adopt.ts). Passed only with that flag on; it never throws. */
  adopt?: (sessionId: string, presentationId: string) => Promise<import('@/lib/studio-duplicate-adopt').DuplicateAdoptOutcome> // DUPLICATE-ADOPT
}

export interface DuplicateDeckInput {
  source: { sessionId: string; shownTitle: string; currentStage?: number | null; slideCount?: number | null }
  target: DuplicateTargetOk
  deps: DuplicateDeckDeps
}

export interface DuplicateDeckSuccess {
  ok: true
  sessionId: string
  title: string
  slot: DeckSlot
  presentationId: string
  presentationUrl: string
  slideCount: number
  currentStage: number
  /** Layout answered "reused" (the same operation id was already copied). */
  reused: boolean
  session: Record<string, unknown> | null
  /** DUPLICATE-ADOPT: step 4's outcome; absent when the step did not run (no `adopt`, or a strawman-slot copy). */
  adoption?: import('@/lib/studio-duplicate-adopt').DuplicateAdoptOutcome // DUPLICATE-ADOPT
}

export interface DuplicateDeckLayoutFailure { ok: false; step: 'layout'; reason: LayoutFailureReason; message: string }
export interface DuplicateDeckSessionFailure {
  ok: false
  step: 'session'
  message: string
  /** The Layout copy exists and cannot be deleted from here. */
  strayLayoutPresentationId: string
  sessionCleanup: 'removed' | 'failed'
}
export type DuplicateDeckResult = DuplicateDeckSuccess | DuplicateDeckLayoutFailure | DuplicateDeckSessionFailure

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const layoutFailure = (reason: LayoutFailureReason): DuplicateDeckLayoutFailure =>
  ({ ok: false, step: 'layout', reason, message: LAYOUT_FAILURE_MESSAGE[reason] })

async function readBody(response: Response): Promise<any> {
  try { return await response.json() } catch { return null }
}

/** Absolute viewer URL of the copy. Layout answers with a RELATIVE "/p/{id}"; an absolute URL (a later Layout) is kept as it is. */
function copyViewerUrl(base: string, body: any, id: string): string {
  const trimmed = base.replace(/\/+$/, '')
  const candidate = typeof body?.presentation_url === 'string' && body.presentation_url ? body.presentation_url
    : typeof body?.url === 'string' && body.url ? body.url : ''
  if (/^https?:\/\//i.test(candidate)) return candidate
  if (candidate.startsWith('/')) return `${trimmed}${candidate}`
  return `${trimmed}/p/${encodeURIComponent(id)}`
}

function stageFor(slot: DeckSlot, sourceStage: number | null | undefined): number {
  return Number.isInteger(sourceStage) && (sourceStage as number) >= 4 && (sourceStage as number) <= 6 ? (sourceStage as number) : slot === 'final' ? 6 : 4
}

/** Soft-delete the half-made session. A 404 means there is nothing to remove. */
async function removeSession(deps: DuplicateDeckDeps, sessionId: string): Promise<'removed' | 'failed'> {
  try {
    const response = await deps.fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
    return response.ok || response.status === 404 ? 'removed' : 'failed'
  } catch {
    return 'failed'
  }
}

async function patchWithRetry(deps: DuplicateDeckDeps, sessionId: string, body: unknown): Promise<Response> {
  const init = { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }
  let response = await deps.fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, init)
  for (const delay of PATCH_RETRY_DELAYS_MS) {
    if (response.status !== 404) break
    await deps.sleep(delay)
    response = await deps.fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, init)
  }
  return response
}

export async function runDuplicateDeck({ source, target, deps }: DuplicateDeckInput): Promise<DuplicateDeckResult> {
  let operationId: string
  let newSessionId: string
  try {
    operationId = deps.newId()
    newSessionId = deps.newId()
  } catch {
    return layoutFailure('failed')
  }
  const title = duplicateTitle(source.shownTitle)

  // 1. Layout copies the deck. A failure here leaves nothing behind.
  let base: string
  try { base = deps.layoutBaseUrl() } catch { return layoutFailure('not_configured') }
  let layoutResponse: Response
  try {
    layoutResponse = await deps.fetch(`${base.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(target.presentationId)}/duplicate`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ operation_id: operationId, title }),
    })
  } catch {
    return layoutFailure('unreachable')
  }
  if (!layoutResponse.ok) {
    const body = await readBody(layoutResponse)
    if (layoutResponse.status === 404) {
      // Layout with the flag off answers FastAPI's own "Not Found"; a missing source is the endpoint's "Presentation not found".
      return layoutFailure(typeof body?.detail === 'string' && /presentation not found/i.test(body.detail) ? 'source_missing' : 'unavailable')
    }
    return layoutFailure('failed')
  }
  const layoutBody = await readBody(layoutResponse)
  const copyId = typeof layoutBody?.presentation_id === 'string' && layoutBody.presentation_id ? layoutBody.presentation_id
    : typeof layoutBody?.id === 'string' && layoutBody.id ? layoutBody.id : ''
  if (!layoutBody || layoutBody.success === false || !copyId) return layoutFailure('failed')
  const presentationUrl = copyViewerUrl(base, layoutBody, copyId)
  const slideCount = Number.isInteger(layoutBody.slide_count) && layoutBody.slide_count >= 0 ? layoutBody.slide_count : (source.slideCount ?? 0)
  const currentStage = stageFor(target.slot, source.currentStage)

  // 2 and 3. The session row. Any failure from here on removes the new session and says a stray Layout copy may remain.
  const unfinished = async (): Promise<DuplicateDeckSessionFailure> => {
    const sessionCleanup = await removeSession(deps, newSessionId)
    return {
      ok: false,
      step: 'session',
      message: [COPY_UNFINISHED_MESSAGE, COPY_STRAY_NOTE, ...(sessionCleanup === 'failed' ? [COPY_SESSION_NOT_REMOVED_NOTE] : [])].join(' '),
      strayLayoutPresentationId: copyId,
      sessionCleanup,
    }
  }

  try {
    const created = await deps.fetch('/api/sessions', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ sessionId: newSessionId, title }) })
    if (!created.ok) return await unfinished()

    const slotFields = target.slot === 'final'
      ? { finalPresentationUrl: presentationUrl, finalPresentationId: copyId }
      : { strawmanPreviewUrl: presentationUrl, strawmanPresentationId: copyId }
    const patched = await patchWithRetry(deps, newSessionId, {
      currentStage,
      slideCount,
      lastMessageAt: deps.now().toISOString(),
      ...slotFields,
      stateCache: {
        activeVersion: target.slot,
        currentStatus: { copiedFrom: { sessionId: source.sessionId, title: source.shownTitle } },
      },
    })
    if (!patched.ok) return await unfinished()
    // DUPLICATE-ADOPT 4. The Director adopts the copy into the new session so chat can edit it: after the PATCH, before the copy is handed back (so before anyone can open it). Final slot only (a
    // DUPLICATE-ADOPT strawman copy is an outline preview). A failure is reported on the result and never removes the copy or the session; an `adopt` that throws is a failure, not a reason to unwind.
    const adopt = target.slot === 'final' ? deps.adopt : undefined // DUPLICATE-ADOPT
    const adoption = adopt ? await Promise.resolve().then(() => adopt(newSessionId, copyId)).catch(() => ({ ok: false as const, status: 0, code: null, retryable: false, attempts: 0 })) : undefined // DUPLICATE-ADOPT

    const patchedBody = await readBody(patched)
    return {
      ok: true,
      sessionId: newSessionId,
      title,
      slot: target.slot,
      presentationId: copyId,
      presentationUrl,
      slideCount,
      currentStage,
      reused: layoutBody.reused === true,
      session: patchedBody && typeof patchedBody.session === 'object' ? patchedBody.session : null,
      ...(adoption ? { adoption } : {}), // DUPLICATE-ADOPT
    }
  } catch {
    return await unfinished()
  }
}
