import { presentationIdFromViewerUrl } from './builder-presentation-ownership'
import type { LayoutViewerUrlDecision } from './layout-viewer-url-policy'

/**
 * NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED (exact "true", default off, build-time): PROGRAM-1 "thumbnails instead of live viewers in the deck list".
 *
 * Today every card on the Decks page (app/(app)/dashboard/page.tsx, PresentationPreview) is an <iframe> of the full Layout viewer for that deck; six at once were
 * measured at 23-66 s, about 100 requests each. On, a card whose viewer URL the policy ALLOWS (lib/layout-viewer-url-policy.ts) shows its deck's first-slide image
 * instead. Source: Layout's slide inventory, the rail's own route (lib/slide-rail-identity.ts reads the same one):
 *   GET {configured Layout URL}/api/presentations/{id}/slides/inventory
 * The id is the one in the card's allowed viewer URL (/p/{id}); the read goes to the CONFIGURED Layout origin only, never to another allowed origin.
 *
 * The image (the same rule as FRONTEND-2's Publish preview, #495/#498): the row at index 0; its `thumbnail_url` when that is non-null (and the row is not flagged stale),
 * else `last_good_thumbnail_url` (additive; absent while Layout's LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED is off, and then it reads as null). Contract:
 * THUMBNAILS-BLANK-UAT "Contract: never blank". An image that is the last good one (not fresh) is drawn with a small "May lag" cue and an accessible label by reason.
 *
 * Reads: exactly ONE per presentation id for the page's life (the store below caches the answer, a failure too, and shares a read already in flight), none while the card
 * is off-screen (the hook reads on the card's FIRST visibility, through an IntersectionObserver), no polling, no retry. The read has a time limit.
 *
 * Fallback, never blanker than today: a failed, hung, absent or unusable read (no row 0, no URL, another presentation's body), a missing IntersectionObserver, an id the
 * policy did not allow, and an image that fails to load all render TODAY'S preview (the iframe for an allowed URL, the placeholder for an empty or blocked one).
 * Off, nothing here runs: no read, no observer, and the card is the base's. This module is pure: no React, no storage, no timers beyond the read's time limit.
 */
export const STUDIO_DECK_CARD_THUMBNAILS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED === 'true'

/** The flag's rule: the exact string "true" (nothing looser). Exported so the rule itself can be proven. */
export function deckCardThumbnailsEnabled(value: string | undefined): boolean {
  return value === 'true'
}

/** The inventory read's time limit (the same bound as the Publish preview's and the deck-changed notice's reads): a hung read ends in today's preview. */
export const DECK_CARD_THUMBNAIL_TIMEOUT_MS = 8_000

// ---- the "may lag" cue ----
// A LOCAL copy of FRONTEND-2's strings, behind this flag only: replace with an import from lib/studio-thumbnail-last-good.ts once FRONTEND-2's stack (#498) merges.
// THUMBNAIL_LAG_TEXT, THUMBNAIL_LAG_LABELS, thumbnailLagReason() and thumbnailLagLabel() are copied from there word for word.

/** Why the image is not fresh: the slide changed since the capture, or the deck's theme did. */
export type ThumbnailLagReason = 'content' | 'theme'

/** The visible cue on the card's preview (both reasons), small and plain. */
export const THUMBNAIL_LAG_TEXT = 'May lag'

/** The accessible label of the cue, by reason. */
export const THUMBNAIL_LAG_LABELS: Readonly<Record<ThumbnailLagReason, string>> = {
  content: 'Preview may not show recent edits',
  theme: 'Preview shows the previous theme',
}

/** "theme" is the theme reason; null, absent and any other value read as the content reason. */
export function thumbnailLagReason(value: unknown): ThumbnailLagReason {
  return value === 'theme' ? 'theme' : 'content'
}

/** The accessible label for a reason (the content label for null or an unknown one). */
export function thumbnailLagLabel(value: unknown): string {
  return THUMBNAIL_LAG_LABELS[thumbnailLagReason(value)]
}

// ---- what a card draws ----

/** The first-slide image, and whether it is the last good one. `lag` null = a fresh image (no cue); otherwise the reason the cue names. */
export interface DeckCardThumbnail {
  url: string
  lag: ThumbnailLagReason | null
}

/** What one read found. Anything but `image` means "draw today's preview". */
export type DeckCardThumbnailResult =
  | { kind: 'image'; thumbnail: DeckCardThumbnail }
  | { kind: 'fallback'; reason: string }

const MAX_URL_LENGTH = 8192
const MAX_ID_LENGTH = 200

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An http(s) URL of sane length, trimmed; anything else is null (the same rule as the rail's thumbnail URLs). */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null
  } catch {
    return null
  }
}

/**
 * The presentation a card may read, from the viewer decision the card already made. Only an ALLOWED decision on the configured Layout origin has one: an empty or blocked
 * decision, an extra allowed origin (its deck is not in the configured Layout) and a URL without /p/{id} are null, so the card keeps today's preview.
 */
export function deckCardThumbnailTarget(
  decision: LayoutViewerUrlDecision | null | undefined,
  configuredOrigin: string | null | undefined,
): { presentationId: string } | null {
  if (!decision || decision.status !== 'allowed') return null
  if (!configuredOrigin || decision.origin !== configuredOrigin) return null
  const id = presentationIdFromViewerUrl(decision.url)
  if (!id || id.length > MAX_ID_LENGTH || id !== id.trim() || /[\u0000-\u001f\u007f]/.test(id)) return null
  return { presentationId: id }
}

/**
 * The row rule. `row` is slide 0 of the inventory as Layout sent it (snake_case): `thumbnail_url` when non-null and the row is not flagged stale (fresh, no cue); else
 * `last_good_thumbnail_url` (absent = null) with the cue, its reason `thumbnail_stale_reason` ("theme", or "content" for null and anything else); else null.
 */
export function deckCardThumbnailFromRow(row: unknown): DeckCardThumbnail | null {
  if (!record(row)) return null
  const fresh = row.thumbnail_stale === true ? null : safeUrl(row.thumbnail_url)
  if (fresh) return { url: fresh, lag: null }
  const lastGood = safeUrl(row.last_good_thumbnail_url)
  return lastGood ? { url: lastGood, lag: thumbnailLagReason(row.thumbnail_stale_reason) } : null
}

const fallback = (reason: string): DeckCardThumbnailResult => ({ kind: 'fallback', reason })

/** The inventory body to a result: it must be THIS presentation's own inventory, and only the row at index 0 is read (never another slide's image). */
export function deckCardThumbnailFromBody(body: unknown, presentationId: string): DeckCardThumbnailResult {
  if (!record(body) || body.presentation_id !== presentationId) return fallback('invalid_inventory')
  const slides = body.slides
  if (!Array.isArray(slides) || slides.length === 0) return fallback('no_row')
  const thumbnail = deckCardThumbnailFromRow(slides[0])
  return thumbnail ? { kind: 'image', thumbnail } : fallback('no_url')
}

/** The inventory route, as the rail builds it. */
export function deckCardInventoryUrl(baseUrl: string, presentationId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(presentationId)}/slides/inventory`
}

/**
 * ONE inventory read with a time limit. Never throws and never rejects: every failure (no Layout URL, network, a non-2xx answer, a body that is not JSON or not this
 * presentation's inventory, the time limit) is a `fallback` result. The limit also holds when `fetchImpl` ignores the abort signal.
 */
export async function readDeckCardThumbnail({
  getBaseUrl,
  presentationId,
  fetchImpl,
  timeoutMs = DECK_CARD_THUMBNAIL_TIMEOUT_MS,
}: {
  getBaseUrl: () => string
  presentationId: string
  fetchImpl: typeof fetch
  timeoutMs?: number
}): Promise<DeckCardThumbnailResult> {
  let baseUrl: string
  try { baseUrl = getBaseUrl() } catch { return fallback('no_layout_url') }
  const abort = typeof AbortController === 'function' ? new AbortController() : null
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<DeckCardThumbnailResult>(resolve => {
    timer = setTimeout(() => { abort?.abort(); resolve(fallback('timeout')) }, timeoutMs)
  })
  const read = (async (): Promise<DeckCardThumbnailResult> => {
    try {
      const response = await fetchImpl(deckCardInventoryUrl(baseUrl, presentationId), { cache: 'no-store', signal: abort?.signal })
      if (!response.ok) return fallback(`http_${response.status}`)
      let body: unknown
      try { body = await response.json() } catch { return fallback('invalid_json') }
      return deckCardThumbnailFromBody(body, presentationId)
    } catch (error) {
      return fallback(record(error) && error.name === 'AbortError' ? 'timeout' : 'network')
    }
  })()
  try {
    return await Promise.race([read, limit])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * One answer per presentation id for the page's life. `request` starts the read the FIRST time an id is asked for and returns that same promise to everyone who asks
 * while it is in flight; once it has settled the answer (a failure too) is kept and `read` is never called again for that id. `peek` is the settled answer, or null.
 * `markImageFailed` is for an image that did not load: the id is a fallback from then on.
 */
export function createDeckCardThumbnailStore() {
  const settled = new Map<string, DeckCardThumbnailResult>()
  const inFlight = new Map<string, Promise<DeckCardThumbnailResult>>()
  return {
    peek(presentationId: string): DeckCardThumbnailResult | null {
      return settled.get(presentationId) ?? null
    },
    request(presentationId: string, read: () => Promise<DeckCardThumbnailResult>): Promise<DeckCardThumbnailResult> {
      const done = settled.get(presentationId)
      if (done) return Promise.resolve(done)
      const pending = inFlight.get(presentationId)
      if (pending) return pending
      let started: Promise<DeckCardThumbnailResult>
      try { started = Promise.resolve(read()) } catch { started = Promise.resolve(fallback('network')) }
      const answer = started.catch(() => fallback('network')).then(result => {
        settled.set(presentationId, result)
        inFlight.delete(presentationId)
        return result
      })
      inFlight.set(presentationId, answer)
      return answer
    },
    markImageFailed(presentationId: string): void {
      settled.set(presentationId, fallback('image_error'))
    },
    clear(): void {
      settled.clear()
      inFlight.clear()
    },
  }
}

/** The slice of IntersectionObserver this needs (the DOM's own class is assignable to it). */
export type VisibilityObserverClass = new (
  callback: (entries: ReadonlyArray<{ isIntersecting: boolean }>) => void,
  options?: { rootMargin?: string; threshold?: number },
) => { observe(target: unknown): void; disconnect(): void }

/**
 * Calls `onVisible` ONCE, the first time `target` is on screen, then stops watching. Returns a function that stops watching early, or null when there is no observer
 * (no IntersectionObserver in this browser): the caller then keeps today's preview, because a card whose visibility is unknown must not read.
 */
export function observeFirstVisibility(
  target: unknown,
  onVisible: () => void,
  ObserverClass: VisibilityObserverClass | undefined,
): (() => void) | null {
  if (!target || typeof ObserverClass !== 'function') return null
  let done = false
  const observer = new ObserverClass(entries => {
    if (done || !entries.some(entry => entry.isIntersecting)) return
    done = true
    observer.disconnect()
    onVisible()
  }, { rootMargin: '0px', threshold: 0 })
  observer.observe(target)
  return () => { done = true; observer.disconnect() }
}
