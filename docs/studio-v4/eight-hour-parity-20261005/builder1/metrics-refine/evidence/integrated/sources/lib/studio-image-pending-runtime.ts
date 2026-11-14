/**
 * IMAGE-PENDING-WRITE runtime (flag NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE): the browser pieces behind lib/studio-image-pending-write.ts, which holds the rules.
 * One thing is wired here that the rules file cannot know: whether the Layout viewer still has an unsaved edit. The batch PUT the writes use is a whole-deck
 * read-modify-write, like the viewer's autosave, so a write that lands while an autosave is mid-flight can overwrite it. The viewer announces
 * its save state with `saveStatusChanged` messages (hasPendingChanges false + status "saved" = nothing pending); a tracker keeps the last one, and a write
 * waits for the clean one for at most IMAGE_PENDING_SETTLE_MS. Listening starts at import, and only with the flag on (the first message of a page is
 * seen long before the first job).
 */
import { requireServiceUrl } from '@/lib/service-url'
import { createSaveStatusTracker, isCleanSaveEvent, type SaveStatusTracker } from '@/lib/studio-slide-ops-via-viewer'
import {
  IMAGE_PENDING_SETTLE_MS,
  STUDIO_IMAGE_PENDING_WRITE_ENABLED,
  startImageJobPending,
  type ImagePendingDeps,
  type ImagePendingJob,
} from '@/lib/studio-image-pending-write'

let tracker: SaveStatusTracker | null = null

function viewerSaveTracker(): SaveStatusTracker | null {
  if (tracker || typeof window === 'undefined') return tracker
  tracker = createSaveStatusTracker()
  window.addEventListener('message', event => tracker?.record(event.data))
  return tracker
}

if (STUDIO_IMAGE_PENDING_WRITE_ENABLED) viewerSaveTracker()

function randomNonce(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/**
 * The stored pending state for one hero-background image job, or null when Layout is not configured. Call only with the flag on.
 * The write is made in the background; the caller ends it with `end('ready' | 'failed')` and never waits for either.
 */
export function startImagePendingJob(presentationId: string, slideIndex: number): ImagePendingJob | null {
  if (!presentationId || !Number.isInteger(slideIndex) || slideIndex < 0) return null
  let baseUrl: string
  try {
    baseUrl = requireServiceUrl('Layout service', [{ name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', value: process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL }])
  } catch {
    return null
  }
  const deps: ImagePendingDeps = {
    baseUrl,
    fetchImpl: (url, init) => fetch(url, init),
    now: () => Date.now(),
    nonce: randomNonce,
    settleViewer: async () => {
      const saves = viewerSaveTracker()
      if (!saves || !saves.last() || isCleanSaveEvent(saves.last())) return
      await saves.waitForClean(IMAGE_PENDING_SETTLE_MS).promise
    },
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    warn: (message, detail) => console.warn(message, detail),
  }
  return startImageJobPending(deps, { presentationId, slideIndex })
}
