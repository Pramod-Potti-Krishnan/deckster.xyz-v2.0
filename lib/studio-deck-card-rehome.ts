// AUDIT P-01 and P-07 (production frontend audit): the Decks page's cards say "Preview unavailable in this environment" (and Duplicate says "stored in another environment") for decks that open fine in the Builder.
// Flag NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME (exact "true", default off, build-time). Off, the Decks page is byte for byte what it was and nothing in here runs: no read, no observer, no state.
//
// ROOT CAUSE (app/(app)/dashboard/page.tsx, PresentationPreview and duplicateControl). A session saves the viewer URL of the Layout that built the deck. The page checks that URL against an exact-origin allowlist (this
// environment's Layout) before it draws an iframe or lets the deck be copied; a URL saved by another environment's Layout (a UAT deck on the production page, which share one database) is "blocked", so the card
// shows the amber note and Duplicate is disabled with "stored in another environment". The Builder does not stop there: hooks/use-builder-session.ts asks THIS environment's Layout whether the paired presentation
// id exists (GET {Layout}/api/presentations/{id}) and, if it does, re-homes the URL onto this Layout (lib/layout-viewer-url-policy.ts recoverRestoredLayoutViewerUrls). The Decks page had no such recovery, so a deck
// whose presentation exists on this Layout (it opens, previews and downloads) was still "unavailable" on its card. Not a missing deck: a client-side URL rejection, no failed request needed.
//
// FIX. With the flag on, a card whose saved URL is blocked ONLY because its origin is not this Layout's (reason unapproved_origin) reads, once per presentation id and only when the card first comes on screen, whether
// that id exists on THIS Layout. Exists (HTTP 2xx): the card uses {this Layout}/p/{id}, which the allowlist approves, so it draws the same preview a native deck gets (and Duplicate, which reads the same decision, is
// enabled and copies on this Layout). Does not exist (404): the honest note stays. The read is a plain GET of the presentation, aborted as soon as the status is known (the body is never downloaded), with a time limit; any
// failure (network, 5xx, the limit) keeps today's note. Nothing is written, no URL is stored, and the saved URL on the session is not touched. At most MAX_CONCURRENT_READS run at once; one answer per id for the page's life.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-audit-previews.mjs transpiles this file into a bare function scope with a fake `process`.

export function deckCardRehomeOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_DECK_CARD_REHOME_ENABLED = deckCardRehomeOn(process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME)

/** The existence read's time limit: a hung read ends in today's note. */
export const DECK_CARD_REHOME_TIMEOUT_MS = 8_000
/** Reads in flight at once (a page of cards must not stampede Layout). */
export const DECK_CARD_REHOME_MAX_CONCURRENT_READS = 3

const MAX_ID_LENGTH = 200

/** What one read found: the presentation is on this Layout, is not, or the read could not say. */
export type DeckCardRehomeAnswer = 'here' | 'absent' | 'unknown'

/** The slice of a viewer-URL decision (lib/layout-viewer-url-policy.ts) this reads. */
export interface RehomeDecision {
  status: string
  reason?: string
  url?: string | null
}

/** The id after the last "p" in the path of a saved viewer URL ({origin}/p/{id}); null when there is none or it is not a sane id. Same rule as lib/builder-presentation-ownership presentationIdFromViewerUrl. */
export function rehomePresentationId(savedUrl: string | null | undefined): string | null {
  if (typeof savedUrl !== 'string' || !savedUrl) return null
  try {
    const parts = new URL(savedUrl).pathname.split('/').filter(Boolean)
    const marker = parts.lastIndexOf('p')
    const id = marker >= 0 && parts[marker + 1] ? decodeURIComponent(parts[marker + 1]) : ''
    if (!id || id.length > MAX_ID_LENGTH || id !== id.trim() || /[\u0000-\u001f\u007f]/.test(id)) return null
    return id
  } catch {
    return null
  }
}

/** This Layout's viewer URL for a presentation id: {configuredOrigin}/p/{id} (the shape recoverRestoredLayoutViewerUrls builds). */
export function rehomedViewerUrl(configuredOrigin: string, presentationId: string): string {
  return `${configuredOrigin}/p/${encodeURIComponent(presentationId)}`
}

/**
 * The presentation a card may ask about, or null. Only with the flag on, only for a saved URL the policy blocked for its ORIGIN (not an invalid URL, a bad protocol or credentials: those are never re-homed), a configured
 * Layout origin, and a saved URL that carries an id.
 */
export function rehomeTarget(
  enabled: boolean,
  savedUrl: string | null | undefined,
  decision: RehomeDecision | null | undefined,
  configuredOrigin: string | null | undefined,
): { presentationId: string } | null {
  if (enabled !== true || !configuredOrigin) return null
  if (!decision || decision.status !== 'blocked' || decision.reason !== 'unapproved_origin') return null
  const presentationId = rehomePresentationId(savedUrl)
  return presentationId ? { presentationId } : null
}

/** The presentation read, as Builder's own recovery makes it. */
export function rehomeReadUrl(baseUrl: string, presentationId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(presentationId)}`
}

/**
 * ONE existence read with a time limit. Never throws and never rejects. 2xx is `here`, 404 is `absent`, everything else (no Layout URL, network, 5xx, 401, the time limit) is `unknown`. The response body is never read:
 * the request is aborted as soon as the status is known. The limit also holds when `fetchImpl` ignores the abort signal.
 */
export async function readPresentationHere({
  getBaseUrl,
  presentationId,
  fetchImpl,
  timeoutMs = DECK_CARD_REHOME_TIMEOUT_MS,
}: {
  getBaseUrl: () => string
  presentationId: string
  fetchImpl: (input: string, init?: { cache?: 'no-store'; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>
  timeoutMs?: number
}): Promise<DeckCardRehomeAnswer> {
  let baseUrl: string
  try { baseUrl = getBaseUrl() } catch { return 'unknown' }
  const abort = typeof AbortController === 'function' ? new AbortController() : null
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<DeckCardRehomeAnswer>(resolve => {
    timer = setTimeout(() => { abort?.abort(); resolve('unknown') }, timeoutMs)
  })
  const read = (async (): Promise<DeckCardRehomeAnswer> => {
    try {
      const response = await fetchImpl(rehomeReadUrl(baseUrl, presentationId), { cache: 'no-store', signal: abort?.signal })
      const answer: DeckCardRehomeAnswer = response.ok ? 'here' : response.status === 404 ? 'absent' : 'unknown'
      abort?.abort() // the status is known; the (possibly large) body is not wanted
      return answer
    } catch {
      return 'unknown'
    }
  })()
  try {
    return await Promise.race([read, limit])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * One answer per presentation id for the page's life, with at most `maxConcurrent` reads in flight (the rest wait their turn, first asked first). `request` starts the read the first time an id is asked for and gives
 * everyone who asks the same promise; `peek` is the settled answer or null; `subscribe` is told whenever an answer settles (the page re-renders its Duplicate items from it).
 */
export function createRehomeStore(maxConcurrent: number = DECK_CARD_REHOME_MAX_CONCURRENT_READS) {
  const settled = new Map<string, DeckCardRehomeAnswer>()
  const inFlight = new Map<string, Promise<DeckCardRehomeAnswer>>()
  const waiting: Array<() => void> = []
  const listeners = new Set<() => void>()
  let running = 0
  let version = 0
  const pump = () => {
    while (running < Math.max(1, maxConcurrent) && waiting.length > 0) waiting.shift()!()
  }
  return {
    peek(presentationId: string): DeckCardRehomeAnswer | null {
      return settled.get(presentationId) ?? null
    },
    request(presentationId: string, read: () => Promise<DeckCardRehomeAnswer>): Promise<DeckCardRehomeAnswer> {
      const done = settled.get(presentationId)
      if (done) return Promise.resolve(done)
      const pending = inFlight.get(presentationId)
      if (pending) return pending
      const answer = new Promise<DeckCardRehomeAnswer>(resolve => {
        const start = () => {
          running += 1
          let started: Promise<DeckCardRehomeAnswer>
          try { started = Promise.resolve(read()) } catch { started = Promise.resolve('unknown' as DeckCardRehomeAnswer) }
          started.catch(() => 'unknown' as DeckCardRehomeAnswer).then(result => {
            running -= 1
            settled.set(presentationId, result)
            inFlight.delete(presentationId)
            version += 1
            listeners.forEach(listener => listener())
            resolve(result)
            pump()
          })
        }
        waiting.push(start)
        pump()
      })
      inFlight.set(presentationId, answer)
      return answer
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    /** Changes whenever an answer settles (the page's snapshot for useSyncExternalStore). */
    version(): number {
      return version
    },
    clear(): void {
      settled.clear()
      inFlight.clear()
      waiting.length = 0
      running = 0
      version += 1
    },
  }
}

/**
 * The viewer-URL decision a card (and its Duplicate item) uses. `evaluate` is the page's own policy check. Flag off, an allowed URL, a URL blocked for any reason but its origin, an id that has not been
 * answered (or is absent, or unknown): the page's own decision, untouched. A blocked-by-origin URL whose id is `here`: the decision for this Layout's own URL for that id.
 */
export function rehomeAwareDecision<D extends RehomeDecision>(
  enabled: boolean,
  savedUrl: string | null | undefined,
  evaluate: (url: string | null | undefined) => D,
  configuredOrigin: string | null | undefined,
  peek: (presentationId: string) => DeckCardRehomeAnswer | null,
): D {
  const saved = evaluate(savedUrl)
  const target = rehomeTarget(enabled, savedUrl, saved, configuredOrigin)
  if (!target || peek(target.presentationId) !== 'here') return saved
  const here = evaluate(rehomedViewerUrl(configuredOrigin as string, target.presentationId))
  return here.status === 'allowed' ? here : saved
}
