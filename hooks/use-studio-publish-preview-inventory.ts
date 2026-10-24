import { useEffect, useRef, useState } from 'react'
import { getLayoutServiceUrl } from '@/lib/layout-service-client'
import { fetchSlideInventory } from '@/lib/slide-rail-identity'
import type { StudioPublishPreview, StudioPublishPreviewSource } from '@/lib/studio-publish-preview'
import {
  publishPreviewInventoryRequest,
  publishPreviewInventoryUrl,
  resolvePublishPreviewWithInventory,
  type PublishPreviewInventory,
  type PublishPreviewInventoryState,
} from '@/lib/studio-publish-preview-inventory'

/** Same bound as the deck-changed notice's inventory read (hooks/use-deck-changed-notice.ts): a hung read ends in the unavailable state. */
const INVENTORY_TIMEOUT_MS = 8_000

/** ONE read through the rail's existing reader and the Layout URL every other Studio read uses. null = unavailable or failed. */
async function readLayoutInventory(presentationId: string): Promise<PublishPreviewInventory | null> {
  const abort = typeof AbortController === 'function' ? new AbortController() : null
  const timer = abort ? setTimeout(() => abort.abort(), INVENTORY_TIMEOUT_MS) : null
  try {
    const result = await fetchSlideInventory({
      baseUrl: getLayoutServiceUrl(),
      presentationId,
      fetchImpl: (input, init) => fetch(input, init),
      signal: abort?.signal,
    })
    return result.kind === 'ok' ? result.inventory : null
  } catch {
    return null
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

/**
 * NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED (default off; lib/studio-publish-preview-inventory.ts): the Publish preview's
 * answer, with Layout's slide inventory as the third source after the live Stage F image and the restored thumbnail. `base` is the
 * existing resolver's answer. Off, or with a live or restored image, or when the source is not this session's Final deck, it is returned
 * as it is and no request is made. Otherwise the deck's inventory is read once per session + Final deck (a result for another deck is
 * never used); the answer is loading until it lands, then the fresh slide-0 image, or the unavailable state.
 */
export function useStudioPublishPreviewInventory(
  publishSessionId: string | null,
  source: StudioPublishPreviewSource | null | undefined,
  base: StudioPublishPreview,
): StudioPublishPreview {
  const request = publishPreviewInventoryRequest(base, publishSessionId, source)
  const [state, setState] = useState<PublishPreviewInventoryState>({})
  const askedRef = useRef<string | null>(null)
  const key = request?.key ?? null
  useEffect(() => {
    if (!request || askedRef.current === request.key) return
    askedRef.current = request.key
    const { key: askedKey, presentationId } = request
    void readLayoutInventory(presentationId).then(
      inventory => setState(previous => ({ ...previous, [askedKey]: publishPreviewInventoryUrl(inventory, presentationId) })),
      () => setState(previous => ({ ...previous, [askedKey]: null })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return resolvePublishPreviewWithInventory(base, publishSessionId, source, state)
}
