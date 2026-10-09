/**
 * Live mini-preview for rail cards that will never get a thumbnail (F9-A).
 *
 * Behind NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED (exact 'true', default off).
 *
 * Layout's slide inventory answers `thumbnail_status: "none"` for a slide that has no producer
 * (manual, catalog and blank slides) and for a failed Stage F registration: nothing is coming,
 * so the rail card says "No preview". With the flag on, such a card shows the slide itself
 * instead: an iframe of the VIEW-ONLY Layout viewer opened on that slide, scaled down by the
 * component. This module holds the rules and nothing else (pure: no React, no DOM, no network):
 *
 *  - the none-only gate: pending, stale and fresh cards, and any card holding a real thumbnail
 *    URL, never get a frame (a real image is never replaced, and drops the frame at once);
 *  - the frame URL: the existing view-only builder (`presentFrameUrl`, `?viewOnly=true#/N`) on the
 *    deck's already approved viewer URL, checked against the Layout viewer allow-list again;
 *  - a module-level slot pool: at most RAIL_LIVE_PREVIEW_MAX_FRAMES frames across the whole rail,
 *    everyone else waits (and keeps showing "No preview") until a slot frees;
 *  - a per-card controller: a frame is mounted only while the card is eligible AND visible.
 */

import { presentFrameUrl } from '@/lib/present-view-only'
import { evaluateLayoutViewerUrl, type LayoutViewerUrlPolicy } from '@/lib/layout-viewer-url-policy'

export const STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED === 'true'

/** Hard cap on live frames across the whole rail (each one loads the full viewer for the deck). */
export const RAIL_LIVE_PREVIEW_MAX_FRAMES = 3

/** The size Layout renders a slide at (Reveal width x height); the frame is laid out at this size and scaled down. */
export const RAIL_LIVE_PREVIEW_STAGE = { width: 1920, height: 1080 } as const

/** Same status vocabulary as the slide inventory (lib/slide-rail-identity.ts), kept loose so a legacy row (no status) is just "not none". */
type PreviewStatus = string | null | undefined

/**
 * The none-only gate. `none` is Layout's word for "no preview, none is coming"; `pending` (one is
 * expected), `stale` and `fresh` keep today's rendering, and a row that carries a usable thumbnail
 * URL is never replaced whatever its status says.
 */
export function railLivePreviewApplies(row: { thumbnailStatus?: PreviewStatus; thumbnailUrl?: string | null }): boolean {
  if (row.thumbnailStatus !== 'none') return false
  return !(typeof row.thumbnailUrl === 'string' && row.thumbnailUrl.trim())
}

/**
 * The frame URL for one card, or null when there must be no frame. `viewerUrl` is the deck's viewer
 * URL the page already approved; `slideIndex` is the 0-based slide to open on. The URL that is built
 * goes through the Layout viewer allow-list (the same policy the canvas iframe is held to), so a frame
 * can only ever load an approved origin.
 */
export function railLivePreviewSrc(
  viewerUrl: string | null | undefined,
  slideIndex: number,
  policy: LayoutViewerUrlPolicy,
): string | null {
  if (!viewerUrl || !Number.isSafeInteger(slideIndex) || slideIndex < 0) return null
  let built: string
  try {
    built = presentFrameUrl(viewerUrl, slideIndex)
  } catch {
    return null
  }
  const decision = evaluateLayoutViewerUrl(built, policy)
  return decision.status === 'allowed' ? decision.url : null
}

/** Scale that fits the Layout stage into a card `width` CSS pixels wide (a bad width gives 0: draw nothing). */
export function railLivePreviewScale(width: number): number {
  return Number.isFinite(width) && width > 0 ? width / RAIL_LIVE_PREVIEW_STAGE.width : 0
}

// ---------------------------------------------------------------- slot pool

export interface RailPreviewSlotTicket {
  /** True while this ticket holds a slot (a frame may be mounted). */
  readonly granted: boolean
  /** Frees the slot, or leaves the queue. Safe to call more than once. */
  release(): void
}

export interface RailPreviewSlotPool {
  /** Asks for a slot. `onGrant` runs when the ticket is granted: at once if a slot is free, else when one frees (FIFO). */
  request(onGrant: () => void): RailPreviewSlotTicket
  readonly active: number
  readonly waiting: number
  readonly max: number
}

export function createRailPreviewSlotPool(max: number = RAIL_LIVE_PREVIEW_MAX_FRAMES): RailPreviewSlotPool {
  const limit = Math.max(0, Math.floor(max))
  let active = 0
  const queue: Array<{ onGrant: () => void; grant: () => void }> = []

  const drain = () => {
    while (active < limit && queue.length > 0) queue.shift()!.grant()
  }

  return {
    request(onGrant) {
      let state: 'waiting' | 'granted' | 'released' = 'waiting'
      const entry = {
        onGrant,
        grant: () => {
          state = 'granted'
          active += 1
          onGrant()
        },
      }
      const ticket: RailPreviewSlotTicket = {
        get granted() { return state === 'granted' },
        release() {
          if (state === 'granted') {
            state = 'released'
            active -= 1
            drain()
          } else if (state === 'waiting') {
            state = 'released'
            const at = queue.indexOf(entry)
            if (at >= 0) queue.splice(at, 1)
          }
        },
      }
      queue.push(entry)
      drain()
      return ticket
    },
    get active() { return active },
    get waiting() { return queue.length },
    get max() { return limit },
  }
}

/** The one pool the whole rail shares. */
export const railPreviewSlots: RailPreviewSlotPool = createRailPreviewSlotPool(RAIL_LIVE_PREVIEW_MAX_FRAMES)

// ---------------------------------------------------------------- per-card controller

export interface RailLivePreviewController {
  /** The card may show a live frame at all (flag on, status none, no real thumbnail, an approved URL). */
  setEligible(eligible: boolean): void
  /** The card is on screen (IntersectionObserver). */
  setVisible(visible: boolean): void
  /** Whether a frame is mounted right now. */
  readonly mounted: boolean
  /** Frees any slot; the controller stays inert afterwards. */
  dispose(): void
}

/**
 * One card's frame lifecycle. A slot is held exactly while the card is eligible AND visible; the
 * frame is mounted exactly while the slot is held. Losing either (scrolled away, the thumbnail
 * arrived, the status left `none`) releases the slot at once and unmounts the frame.
 */
export function createRailLivePreviewController({
  pool,
  onChange,
}: {
  pool: RailPreviewSlotPool
  onChange: (mounted: boolean) => void
}): RailLivePreviewController {
  let eligible = false
  let visible = false
  let ticket: RailPreviewSlotTicket | null = null
  let mounted = false
  let disposed = false

  const publish = () => {
    const next = !disposed && Boolean(ticket?.granted)
    if (next === mounted) return
    mounted = next
    onChange(next)
  }

  const reconcile = () => {
    const want = !disposed && eligible && visible
    if (want && !ticket) {
      // A free slot grants inside request() (before `ticket` is set; the publish below sees it), a busy pool
      // grants later when a slot frees (the callback publishes). A released ticket never calls back.
      ticket = pool.request(publish)
    } else if (!want && ticket) {
      const held = ticket
      ticket = null
      held.release()
    }
    publish()
  }

  return {
    setEligible(next) { if (next !== eligible) { eligible = next; reconcile() } },
    setVisible(next) { if (next !== visible) { visible = next; reconcile() } },
    get mounted() { return mounted },
    dispose() {
      disposed = true
      reconcile()
    },
  }
}
