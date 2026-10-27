/**
 * FRONTEND-2 Pass 3 (P3-1 A, NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT, default off): what the chat element edit needs from the presentation viewer that
 * the viewer's API does not give a caller, with no imports (the viewer imports it, so the viewer gains no dependency).
 *
 *  1. The viewer's save acknowledgements. Layout's auto-save.js posts `saveStatusChanged {status, hasPendingChanges}` to the parent as the deck goes
 *     unsaved -> saving -> saved (or error); components/presentation-viewer.tsx already validates the sender and keeps the latest status in its own
 *     state. With the flag on it also hands each message to publishViewerSaveEvent, here, so the runner can wait for the ack of ITS change
 *     (watchViewerSave): `ok:true` means saved.
 *  2. The viewer's own lazy edit mode (ensureEditMode: what selecting an element does). Layout's autosave drops every change made while the viewer is
 *     not in edit mode (src/utils/auto-save.js markContentChanged), so an edit from chat must enter it the same way, with the viewer's React state kept in step.
 *
 * Flag off: nothing publishes or registers, and nothing here runs.
 */

export type ViewerSaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

export interface ViewerSaveEvent {
  status: ViewerSaveStatus
  /** Layout's `hasPendingChanges` (null when the message does not carry it). */
  hasPendingChanges: boolean | null
}

const listeners = new Set<(event: ViewerSaveEvent) => void>()

/** Called by the viewer for every trusted `saveStatusChanged` / `save_status` message with a valid status (flag on only). */
export function publishViewerSaveEvent(event: ViewerSaveEvent): void {
  for (const listener of [...listeners]) listener(event)
}

export function subscribeViewerSaveEvents(listener: (event: ViewerSaveEvent) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export type SaveWatchOutcome = 'saved' | 'error' | 'timeout'

export interface SaveWatch {
  /** Resolves when the change this watch was opened for is saved ('saved'), the save failed ('error'), or the budget ran out ('timeout'). */
  settled(timeoutMs: number): Promise<SaveWatchOutcome>
  /** True once the viewer reported the change as tracked (unsaved or saving) since the watch opened. */
  tracked(): boolean
  /** Unsubscribes; settled() still resolves (with what it has seen, else 'timeout' is not awaited). */
  close(): void
}

export interface SaveWatchTimers {
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (id: unknown) => void
}

const globalTimers: SaveWatchTimers = {
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: id => clearTimeout(id as ReturnType<typeof setTimeout>),
}

/**
 * Opens a watch BEFORE the first command of an edit goes out. Layout posts `unsaved` while it handles the command (before its reply), so an ack
 * is only ever "a `saved` with nothing pending that came AFTER the change was tracked": a `saved` from an earlier save never counts, and a
 * change the viewer never tracked (it was not in edit mode) never reads as saved. An `error` after tracking is a failed save.
 */
export function watchViewerSave(
  subscribe: (listener: (event: ViewerSaveEvent) => void) => () => void = subscribeViewerSaveEvents,
  timers: SaveWatchTimers = globalTimers,
): SaveWatch {
  let tracked = false
  let outcome: SaveWatchOutcome | null = null
  let wake: (() => void) | null = null
  const finish = (next: SaveWatchOutcome) => {
    if (outcome) return
    outcome = next
    wake?.()
  }
  const unsubscribe = subscribe(event => {
    if (outcome) return
    if (event.status === 'unsaved' || event.status === 'saving') { tracked = true; return }
    if (!tracked) return
    if (event.status === 'saved' && event.hasPendingChanges !== true) finish('saved')
    else if (event.status === 'error') finish('error')
  })
  return {
    tracked: () => tracked,
    close: () => unsubscribe(),
    settled(timeoutMs: number): Promise<SaveWatchOutcome> {
      return new Promise<SaveWatchOutcome>(resolve => {
        if (outcome) { unsubscribe(); resolve(outcome); return }
        const timer = timers.setTimer(() => finish('timeout'), timeoutMs)
        wake = () => {
          timers.clearTimer(timer)
          unsubscribe()
          resolve(outcome as SaveWatchOutcome)
        }
      })
    },
  }
}

/** What the mounted viewer offers an edit from chat. */
export interface ChatEditViewerHandle {
  /** The viewer's own lazy edit mode (presentation-viewer.tsx ensureEditMode): true when the viewer is in edit mode afterwards. */
  ensureEditMode: () => Promise<boolean>
}

let viewerHandle: ChatEditViewerHandle | null = null

/** The viewer registers its handle while it is ready (flag on only) and gets an unregister function back. */
export function registerChatEditViewer(handle: ChatEditViewerHandle): () => void {
  viewerHandle = handle
  return () => { if (viewerHandle === handle) viewerHandle = null }
}

export function getChatEditViewer(): ChatEditViewerHandle | null {
  return viewerHandle
}
