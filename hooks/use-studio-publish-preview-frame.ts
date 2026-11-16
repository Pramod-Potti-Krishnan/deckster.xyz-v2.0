import { useEffect, useRef, useState } from 'react'
import { LAYOUT_VIEWER_URL_POLICY, getLayoutServiceUrl } from '@/lib/layout-service-client'
import { railLivePreviewSrc } from '@/lib/rail-live-preview'
import type { StudioPublishPreview, StudioPublishPreviewSource } from '@/lib/studio-publish-preview'
import { readPresentationHere, rehomedViewerUrl, type DeckCardRehomeAnswer } from '@/lib/studio-deck-card-rehome'
import { STUDIO_INVENTORY_FALLBACK_ENABLED, publishFrameRequest } from '@/lib/studio-inventory-fallback'

/**
 * NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK (default off; lib/studio-inventory-fallback.ts): when the Publish preview has NO image from any source (`preview` is the answer of the live, restored and inventory sources),
 * and this Layout has the session's Final deck, the preview shows slide 1 itself in a view-only frame: `{ src }`. One read per session + Final deck (the presentation GET, aborted at the status). Off, with an image,
 * while the preview is loading, for a source that is not this session's Final deck, or when the deck is not on this Layout: null, and the preview is what it was.
 */
export function useStudioPublishPreviewFrame(
  publishSessionId: string | null,
  source: StudioPublishPreviewSource | null | undefined,
  preview: StudioPublishPreview,
): { src: string } | null {
  const request = STUDIO_INVENTORY_FALLBACK_ENABLED ? publishFrameRequest(preview.status, publishSessionId, source) : null
  const [answers, setAnswers] = useState<Record<string, DeckCardRehomeAnswer>>({})
  const askedRef = useRef<string | null>(null)
  const key = request?.key ?? null
  useEffect(() => {
    if (!request || askedRef.current === request.key) return
    askedRef.current = request.key
    const { key: askedKey, presentationId } = request
    void readPresentationHere({ getBaseUrl: getLayoutServiceUrl, presentationId, fetchImpl: (input, init) => fetch(input, init) }).then(
      answer => setAnswers(previous => ({ ...previous, [askedKey]: answer })),
      () => setAnswers(previous => ({ ...previous, [askedKey]: 'unknown' })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const origin = LAYOUT_VIEWER_URL_POLICY.configuredOrigin
  if (!request || !origin || answers[request.key] !== 'here') return null
  const src = railLivePreviewSrc(rehomedViewerUrl(origin, request.presentationId), 0, LAYOUT_VIEWER_URL_POLICY)
  return src ? { src } : null
}
