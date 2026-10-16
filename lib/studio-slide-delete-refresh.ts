/**
 * PASS2D B4 (flag NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH, exact "true", default off): after a slide is deleted the canvas stops showing it.
 *
 * What the code does today. Studio's delete sends the viewer the `deleteSlides` command. Layout's handler (presentation-viewer.html, handleBulkDeleteSlides)
 * sends DELETE /api/presentations/{id}/slides/bulk and, on success, calls window.location.reload() and replies {success:true}. The reply reaches Studio at once:
 * it updates its own count, selection and rail, shows the "Slide Deleted" toast and releases the delete dialog. The iframe, meanwhile, keeps showing the OLD
 * document (the deleted slide included, still clickable, with its own "2 / 11" counter) until the reloaded one paints. On the UAT Layout that first paint takes
 * 14-20 s (blocking CDN scripts), so for that long the canvas contradicts the rail ("Slide 2 / 10" beside a canvas that says "2 / 11"), and an edit made in the
 * stale document is autosaved over the new deck. Measured against the real Layout viewer with a 6 s first paint: the deleted slide stays on the canvas for the whole 6 s.
 * A reload shows the right thing because it waits for the new document, which is all this does.
 *
 * With the flag on: when the delete is acknowledged and no new frame has loaded since the command was sent, the canvas is covered by the viewer's own
 * "Updating your slides…" state until the reloaded frame reports its load (Studio already counts frame lifetimes: studioComposeLoadRevisionRef), or 45 s
 * pass, whichever is first. A frame that loaded between the send and the reply (a fast reload) never starts a veil, so it cannot be left up.
 * Flag off: nothing in this file runs, the veil component is not mounted, and the viewer behaves exactly as before.
 *
 * Pure, no imports: the test loads this file on its own.
 */
export const STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH === 'true'

/** The longest the veil stays up if no frame load is ever reported (a Layout that did not reload, or a load event that never fires). */
export const STUDIO_SLIDE_DELETE_REFRESH_TIMEOUT_MS = 45_000

export interface SlideDeleteRefreshClock {
  setTimer(callback: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export interface SlideDeleteRefreshStore {
  /** Whether the canvas must be covered right now. Stable between changes (useSyncExternalStore). */
  getSnapshot(): boolean
  subscribe(listener: () => void): () => void
  /** The deleteSlides command was acknowledged. Veils only if the frame has not already reloaded since the command was sent. Returns whether it veiled. */
  acknowledged(input: { revisionAtSend: number; revisionNow: number }): boolean
  /** A new frame lifetime began (the viewer iframe's load event): the canvas is the new document, lift the veil. */
  frameLoaded(): void
  /** The viewer went away. Lift the veil and drop the timer. */
  reset(): void
}

const realClock: SlideDeleteRefreshClock = {
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function createSlideDeleteRefreshStore(clock: SlideDeleteRefreshClock = realClock, timeoutMs: number = STUDIO_SLIDE_DELETE_REFRESH_TIMEOUT_MS): SlideDeleteRefreshStore {
  let active = false
  let timer: unknown = null
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of [...listeners]) listener() }
  const lift = () => {
    if (timer !== null) { clock.clearTimer(timer); timer = null }
    if (!active) return
    active = false
    emit()
  }
  return {
    getSnapshot: () => active,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    acknowledged({ revisionAtSend, revisionNow }) {
      if (revisionNow !== revisionAtSend) return false
      if (timer !== null) clock.clearTimer(timer)
      timer = clock.setTimer(() => { timer = null; lift() }, timeoutMs)
      if (!active) { active = true; emit() }
      return true
    },
    frameLoaded: lift,
    reset: lift,
  }
}

/** The one store the viewer and its veil share (one viewer per Builder page). */
export const studioSlideDeleteRefresh = createSlideDeleteRefreshStore()
