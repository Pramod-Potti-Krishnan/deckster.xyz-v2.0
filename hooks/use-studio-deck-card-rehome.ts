import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { LAYOUT_VIEWER_URL_POLICY, getLayoutServiceUrl } from '@/lib/layout-service-client'
import { observeFirstVisibility, type VisibilityObserverClass } from '@/lib/studio-deck-card-thumbnail'
import {
  STUDIO_DECK_CARD_REHOME_ENABLED,
  createRehomeStore,
  readPresentationHere,
  rehomeAwareDecision,
  rehomeTarget,
  rehomedViewerUrl,
  type RehomeDecision,
} from '@/lib/studio-deck-card-rehome'

/** One answer per presentation id for the page's life (module state: it outlives a card, so a re-render, a view switch or a filter never reads again). */
const store = createRehomeStore()

const noSubscribe = () => () => {}

/**
 * NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME (default off; lib/studio-deck-card-rehome.ts): the Decks page's card for a deck whose saved viewer URL belongs to another environment's Layout.
 * Returns what the card needs: `url` (this Layout's viewer URL for the deck, once this Layout has said the presentation exists; else null), `pending` (a read is still due or in flight: the card does not show the
 * "unavailable" note yet) and `boxRef` (the element whose first appearance on screen starts the read; undefined when this card has nothing to ask).
 * Off, or for any card with nothing to ask about (an allowed URL, no URL, a URL blocked for another reason): `{ url: null, pending: false, boxRef: undefined }`, no observer and no read.
 */
export function useStudioDeckCardRehome(savedUrl: string | null | undefined, decision: RehomeDecision): { url: string | null; pending: boolean; boxRef: RefObject<HTMLDivElement | null> | undefined } {
  const target = rehomeTarget(STUDIO_DECK_CARD_REHOME_ENABLED, savedUrl, decision, LAYOUT_VIEWER_URL_POLICY.configuredOrigin)
  const id = target?.presentationId ?? null
  const [, refresh] = useReducer((count: number) => count + 1, 0)
  const [seen, setSeen] = useState(false)
  const [unobservable, setUnobservable] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const answer = id ? store.peek(id) : null

  // First visibility: only a card that still waits for an answer watches, and only until it has been seen once.
  useEffect(() => {
    if (!id || answer || seen) return
    const stop = observeFirstVisibility(box.current, () => setSeen(true), typeof IntersectionObserver === 'function' ? (IntersectionObserver as unknown as VisibilityObserverClass) : undefined)
    if (!stop) { setUnobservable(true); return }
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, answer !== null, seen])

  // The one read, after the first visibility. The store shares it between cards of the same deck and keeps the answer.
  useEffect(() => {
    if (!id || !seen || store.peek(id)) return
    let live = true
    void store.request(id, () => readPresentationHere({ getBaseUrl: getLayoutServiceUrl, presentationId: id, fetchImpl: (input, init) => fetch(input, init) })).then(() => { if (live) refresh() })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, seen])

  if (!id) return { url: null, pending: false, boxRef: undefined }
  const origin = LAYOUT_VIEWER_URL_POLICY.configuredOrigin
  if (answer === 'here' && origin) return { url: rehomedViewerUrl(origin, id), pending: false, boxRef: box }
  // A browser with no IntersectionObserver cannot say when the card is seen: it keeps today's note rather than read for every card.
  return { url: null, pending: !answer && !unobservable, boxRef: box }
}

/** The page's snapshot of "an answer settled" (a number that changes then). With the flag off it never subscribes and is always 0, so the page does not re-render for it. */
export function useStudioDeckRehomeVersion(): number {
  return useSyncExternalStore(STUDIO_DECK_CARD_REHOME_ENABLED ? store.subscribe : noSubscribe, STUDIO_DECK_CARD_REHOME_ENABLED ? store.version : () => 0, () => 0)
}

/** The viewer-URL decision for a saved URL, re-homed to this Layout when the card's read said the deck is here (Duplicate reads this). Flag off: `evaluate(url)`. */
export function studioDeckRehomeDecision<D extends RehomeDecision>(url: string | null | undefined, evaluate: (url: string | null | undefined) => D): D {
  return rehomeAwareDecision(STUDIO_DECK_CARD_REHOME_ENABLED, url, evaluate, LAYOUT_VIEWER_URL_POLICY.configuredOrigin, id => store.peek(id))
}
