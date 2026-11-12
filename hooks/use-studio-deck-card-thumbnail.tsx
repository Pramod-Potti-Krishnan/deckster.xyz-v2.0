import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { StudioDeckCardThumbnailImage, StudioDeckCardThumbnailPending } from '@/components/studio-deck-card-thumbnail'
import { LAYOUT_VIEWER_URL_POLICY, getLayoutServiceUrl } from '@/lib/layout-service-client'
import type { LayoutViewerUrlDecision } from '@/lib/layout-viewer-url-policy'
import {
  STUDIO_DECK_CARD_THUMBNAILS_ENABLED,
  createDeckCardThumbnailStore,
  deckCardThumbnailTarget,
  observeFirstVisibility,
  readDeckCardThumbnail,
  type VisibilityObserverClass,
} from '@/lib/studio-deck-card-thumbnail'

/** One answer per presentation id for the page's life (module state: it outlives a card, so a re-render, a view switch or a filter never reads again). */
const store = createDeckCardThumbnailStore()

/**
 * NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED (default off; lib/studio-deck-card-thumbnail.ts): what a Decks-page card draws in its preview area instead of the live viewer,
 * or null for "draw today's preview" (always null with the flag off, and then nothing below runs: no state change, no observer, no read).
 *  - before the card has been on screen: an empty box (no viewer loaded, no read);
 *  - on its FIRST visibility: ONE inventory read for the deck's presentation (shared and cached per id), none for a card that is never seen;
 *  - an image: the first-slide image (with the "May lag" cue when it is the last good one);
 *  - a failed, hung or unusable read, no IntersectionObserver, an id the policy did not allow, an image that fails to load: null, so the card keeps its iframe or placeholder.
 */
export function useStudioDeckCardThumbnail(decision: LayoutViewerUrlDecision, title: string): ReactNode | null {
  const id = STUDIO_DECK_CARD_THUMBNAILS_ENABLED ? deckCardThumbnailTarget(decision, LAYOUT_VIEWER_URL_POLICY.configuredOrigin)?.presentationId ?? null : null
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
    void store.request(id, () => readDeckCardThumbnail({ getBaseUrl: getLayoutServiceUrl, presentationId: id, fetchImpl: (input, init) => fetch(input, init) })).then(() => { if (live) refresh() })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, seen])

  if (!id) return null
  if (answer) {
    if (answer.kind !== 'image') return null
    return <StudioDeckCardThumbnailImage url={answer.thumbnail.url} title={title} lag={answer.thumbnail.lag} onError={() => { store.markImageFailed(id); refresh() }} />
  }
  if (unobservable) return null
  return <StudioDeckCardThumbnailPending boxRef={box} />
}
