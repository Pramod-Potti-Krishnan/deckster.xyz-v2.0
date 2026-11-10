import type { StudioPublishPreview, StudioPublishPreviewSource } from './studio-publish-preview'

/**
 * NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED (exact "true", default off, build-time): THUMBNAILS-BLANK-UAT fix 1.
 * The Publish preview has two sources only (lib/studio-publish-preview.ts): the live Stage F image from this tab's slide_built frames,
 * and a restored session slide that declares its own presentation. Any deck not built in this tab has neither, and the dialog says
 * "Deck preview unavailable". On, a preview with NEITHER asks Layout's slide inventory (the rail's own reader, lib/slide-rail-identity.ts)
 * once and shows slide 0's `thumbnail_url` ONLY when it is fresh: non-null, not `thumbnail_stale`, and read from THIS presentation's own
 * inventory (the ownership rule). Stale or none keeps today's unavailable state; the read in flight uses the existing loading state, and a
 * failed read the unavailable state. Precedence: live, then restored, then inventory. Off, nothing here runs and no read is made.
 * This module is pure: no React, no network, no storage.
 */
export const STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED === 'true'

/** NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (exact "true", default off): THUMBNAILS-BLANK-UAT "never blank". With BOTH this flag and the one above on, slide 0 with no fresh image shows its `lastGoodThumbnailUrl` (Layout's last registered preview of
 * that slide, fresh or stale; the rows carry it only with this flag on, lib/slide-rail-identity.ts), so "Deck preview unavailable" shows only when no image exists at all. With only the flag above on, the fresh-only rule is exactly as before; with only this
 * one on, no inventory read is made (the request above needs the flag above). The caption "Preview image can lag recent edits" already says what a stale image is. */
const THUMBNAIL_LAST_GOOD = process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD === 'true'

/** The slice of Layout's slide inventory this needs (lib/slide-rail-identity.ts SlideInventory is assignable to it). */
export interface PublishPreviewInventory {
  presentationId: string
  slides: ReadonlyArray<{ thumbnailUrl: string | null; thumbnailStale: boolean; lastGoodThumbnailUrl?: string | null }>
}

/** What each read found, by request key: slide 0's fresh image, or null (stale, none or a failed read). */
export type PublishPreviewInventoryState = Readonly<Record<string, string | null>>

export interface PublishPreviewInventoryRequest {
  /** Session and Final presentation together, so a result never serves another deck. */
  key: string
  session: string
  presentationId: string
}

function nonempty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The one read this preview may make, or null. Only with the flag on, only when the existing resolver found no live or restored image
 * (`base` is its answer: ready and generating both keep their own state), and only for the same session / held-deck owner / Final id
 * gates that resolver applies. */
export function publishPreviewInventoryRequest(
  base: StudioPublishPreview,
  publishSessionId: string | null,
  source?: StudioPublishPreviewSource | null,
): PublishPreviewInventoryRequest | null {
  if (!STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED) return null
  if (base.status !== 'unavailable') return null
  const session = nonempty(publishSessionId)
  const presentationId = nonempty(source?.finalPresentationId)
  if (!session || nonempty(source?.sessionId) !== session || nonempty(source?.ownerSessionId) !== session || !presentationId) return null
  return { key: JSON.stringify([session, presentationId]), session, presentationId }
}

/** Slide 0's image, and only a fresh one of this presentation. A different presentation's inventory, a stale or missing image and any
 * other slide's image are all null: the preview never shows slide 1 with another slide's picture. */
export function publishPreviewInventoryUrl(inventory: PublishPreviewInventory | null | undefined, presentationId: string): string | null {
  if (!inventory || inventory.presentationId !== presentationId) return null
  const first = inventory.slides[0]
  // NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD (default off): with both flags on, no fresh image falls back to slide 0's own last good one (else null, as below). Only the first row, and only this presentation's.
  if (first && THUMBNAIL_LAST_GOOD && STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED && (first.thumbnailStale || !first.thumbnailUrl)) return nonempty(first.lastGoodThumbnailUrl)
  if (!first || first.thumbnailStale || !first.thumbnailUrl) return null
  return nonempty(first.thumbnailUrl)
}

/** The preview to draw. `base` (live, restored, generating, or an unowned/blank source) is returned as it is whenever the flag is off, a
 * live or restored image exists, or no read is allowed; otherwise the read's state decides: in flight is loading, an image is ready,
 * and stale, none or failed is the unavailable state. */
export function resolvePublishPreviewWithInventory(
  base: StudioPublishPreview,
  publishSessionId: string | null,
  source: StudioPublishPreviewSource | null | undefined,
  state: PublishPreviewInventoryState,
): StudioPublishPreview {
  const request = publishPreviewInventoryRequest(base, publishSessionId, source)
  if (!request) return base
  if (!Object.prototype.hasOwnProperty.call(state, request.key)) return { status: 'loading' }
  const thumbnailUrl = state[request.key]
  if (!thumbnailUrl) return { status: 'unavailable' }
  return { status: 'ready', ownerKey: JSON.stringify([request.session, request.presentationId, 'final', thumbnailUrl]), thumbnailUrl }
}
