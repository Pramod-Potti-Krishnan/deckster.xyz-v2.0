/**
 * SLIDE-OPS-VIA-VIEWER (flag NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER, exact "true", default off). Studio side of Layout MR !239
 * (LAYOUT_AUTOSAVE_FLUSH_WHILE_SAVING_ENABLED): an edit that is still pending when a slide is deleted, duplicated or re-laid-out must reach the
 * server BEFORE the change, or the viewer's reload-time save writes the old deck over the new one.
 *
 * What the code does today.
 *   1. The slide panel (components/element-format-panel/slide-format-panel.tsx) calls Layout's REST endpoints itself (lib/layout-service-client.ts:
 *      DELETE slides/{i}, POST slides/{i}/duplicate, PUT slides/{i}/layout). The viewer iframe never hears of it, so it cannot save what is pending first,
 *      and it is not reloaded either: the stale document stays editable and its next autosave is written over the changed deck.
 *   2. Layout's version restore (viewer command restoreVersion, presentation-viewer.html) POSTs .../restore/{id} and reloads the page. Nothing saves
 *      the pending edit first, and Layout's wrapper (!239) does not cover that endpoint. components/version-history-panel.tsx sends the command.
 *
 * With the flag on.
 *   1. The panel sends the viewer's own commands (the ones the slide rail already uses, which call the fetches !239 wraps): duplicateSlide, deleteSlides,
 *      changeSlideLayout. The viewer saves what is pending, runs the change, and reloads. A delete takes the PASS2D B4 path (the canvas veil).
 *   2. Before the restore command goes out, the panel makes sure nothing is pending. The viewer's forceSave command has an acknowledgement, but the
 *      acknowledgement is NOT a flush (the viewer calls saveAllChanges() without awaiting it, and it does nothing outside edit mode). The proof that a save
 *      finished is the viewer's own saveStatusChanged message, status "saved" with hasPendingChanges false. So: if the last status Studio saw is not
 *      that, send forceSave, wait for its acknowledgement, then wait for that status. If it does not come, the restore is not sent.
 * Flag off: nothing in this file runs and the panels behave exactly as before.
 *
 * Today's state of the version history panel (checked against Layout cb1b032, !239): nothing in Studio opens it (showVersionHistory in presentation-viewer.tsx is never set), and it posts
 * {command: ...} where the viewer reads {action: ...} (presentation-viewer.html, the message handler: "if (!action) return"), so its list and restore messages are ignored. The guard
 * below is wired in and proven (against the real viewer, with the envelope the viewer does read), and stays inert until that panel is opened and its envelope fixed.
 *
 * Pure, no imports: the test loads this file on its own.
 */
export const STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER === 'true'

/** A viewer command waits for the save of what is pending, then the request, so it gets the same budget as the other mutating Layout commands. */
export const SLIDE_OP_VIEWER_TIMEOUT_MS = 30_000
/** The forceSave acknowledgement (immediate when it comes at all). */
export const RESTORE_FLUSH_ACK_TIMEOUT_MS = 8_000
/** How long to wait for the viewer to report a finished save before refusing to restore. */
export const RESTORE_FLUSH_SAVE_TIMEOUT_MS = 20_000

export type SlideOpViewerAction = 'duplicateSlide' | 'deleteSlides' | 'changeSlideLayout'

export interface ViewerSlideCommand {
  action: SlideOpViewerAction
  params: Record<string, unknown>
}

export const SLIDE_OP_VIEWER_ACTIONS: readonly SlideOpViewerAction[] = ['duplicateSlide', 'deleteSlides', 'changeSlideLayout']

export function isSlideOpViewerAction(action: string): action is SlideOpViewerAction {
  return (SLIDE_OP_VIEWER_ACTIONS as readonly string[]).includes(action)
}

// The parameter shapes are the ones the slide rail sends (components/presentation-viewer.tsx) and the viewer reads (presentation-viewer.html).
export function duplicateSlideCommand(index: number): ViewerSlideCommand {
  return { action: 'duplicateSlide', params: { index, insert_after: true } }
}
export function deleteSlideCommand(index: number): ViewerSlideCommand {
  return { action: 'deleteSlides', params: { indices: [index] } }
}
export function changeSlideLayoutCommand(index: number, newLayout: string): ViewerSlideCommand {
  return { action: 'changeSlideLayout', params: { index, new_layout: newLayout, preserve_content: true } }
}

/**
 * The slide total a delete or a duplicate leaves, as the viewer's acknowledgement reports it (Layout's bulk delete says remaining_slide_count, its duplicate says slide_count): the numbers the
 * slide rail commits after the same commands. null when the acknowledgement carries none (a layout change changes no count), so nothing is guessed.
 */
export function slideTotalAfterAck(action: string, reply: unknown): number | null {
  const ack = reply as { remaining_slide_count?: unknown; slide_count?: unknown; data?: { slideCount?: unknown } } | null | undefined
  const total = action === 'deleteSlides' ? ack?.remaining_slide_count : action === 'duplicateSlide' ? (ack?.slide_count ?? ack?.data?.slideCount) : undefined
  return typeof total === 'number' && Number.isInteger(total) && total > 0 ? total : null
}

export const SLIDE_OP_UNCONFIRMED_MESSAGE = 'The slide change could not be confirmed. Check the slide list before trying again.'

export interface SlideOpOutcome {
  success: boolean
  error?: { code: string; message: string }
}

/**
 * Runs one viewer command and reports it in the shape the panel already reads from the REST client ({ success, error?: { message } }).
 * Studio's command sender rejects when the viewer answers success:false and when the answer does not come in time.
 */
export async function runSlideOpViaViewer(
  send: (action: string, params: Record<string, unknown>) => Promise<{ success?: boolean; error?: string } | undefined | void>,
  command: ViewerSlideCommand,
  failureMessage: string,
): Promise<SlideOpOutcome> {
  try {
    const reply = await send(command.action, command.params)
    if (reply && reply.success === false) {
      return { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: reply.error || failureMessage } }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/command timeout/i.test(message)) {
      return { success: false, error: { code: 'VIEWER_COMMAND_UNCONFIRMED', message: SLIDE_OP_UNCONFIRMED_MESSAGE } }
    }
    return { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: message || failureMessage } }
  }
}

// ---------------------------------------------------------------- restore: nothing pending before the restore command goes out

export interface RestoreSaveEvent {
  status: string
  hasPendingChanges?: boolean
}

/** The one message that proves a save finished and nothing is waiting: the viewer's saveStatusChanged with status "saved" and no pending changes. */
export function isCleanSaveEvent(event: RestoreSaveEvent | null | undefined): boolean {
  return !!event && event.status === 'saved' && event.hasPendingChanges === false
}

export interface SaveStatusClock {
  setTimer(callback: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export interface CleanSaveWait {
  promise: Promise<boolean>
  cancel(): void
}

export interface SaveStatusTracker {
  /** Feed every saveStatusChanged / save_status message of the viewer frame. Anything else is ignored. */
  record(data: unknown): void
  last(): RestoreSaveEvent | null
  /** Armed at once: resolves true on the next clean save event, false after timeoutMs. */
  waitForClean(timeoutMs: number): CleanSaveWait
}

const realClock: SaveStatusClock = {
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function createSaveStatusTracker(clock: SaveStatusClock = realClock): SaveStatusTracker {
  let last: RestoreSaveEvent | null = null
  const waiters = new Set<() => void>()
  return {
    record(data) {
      const message = data as { type?: unknown; status?: unknown; hasPendingChanges?: unknown } | null | undefined
      if (!message || (message.type !== 'saveStatusChanged' && message.type !== 'save_status')) return
      if (typeof message.status !== 'string' || !['saved', 'unsaved', 'saving', 'error'].includes(message.status)) return
      last = { status: message.status, hasPendingChanges: typeof message.hasPendingChanges === 'boolean' ? message.hasPendingChanges : undefined }
      if (isCleanSaveEvent(last)) for (const settle of [...waiters]) settle()
    },
    last: () => last,
    waitForClean(timeoutMs) {
      let done: (clean: boolean) => void = () => {}
      const promise = new Promise<boolean>(resolve => { done = resolve })
      let timer: unknown = null
      const finish = (clean: boolean) => {
        if (!waiters.delete(settleClean)) return
        if (timer !== null) { clock.clearTimer(timer); timer = null }
        done(clean)
      }
      const settleClean = () => finish(true)
      waiters.add(settleClean)
      timer = clock.setTimer(() => { timer = null; finish(false) }, timeoutMs)
      return { promise, cancel: () => finish(false) }
    },
  }
}

export interface ViewerChannel {
  post(message: { action: string; params: Record<string, unknown>; requestId: string }): void
  /** Subscribes to the viewer frame's messages; the caller has already checked they come from the loaded viewer. Returns the unsubscribe. */
  listen(handler: (data: unknown) => void): () => void
  newRequestId(): string
}

/**
 * One viewer command, resolved by the acknowledgement that carries its action and request id (the viewer echoes both).
 * Rejects when the viewer answers success:false, and when no answer comes within timeoutMs. The acknowledgement says the viewer ran its handler, nothing more.
 */
export function requestViewerAck(
  channel: ViewerChannel,
  action: string,
  params: Record<string, unknown>,
  timeoutMs: number,
  clock: SaveStatusClock = realClock,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = channel.newRequestId()
    let timer: unknown = null
    let unlisten: () => void = () => {}
    let settled = false
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timer !== null) { clock.clearTimer(timer); timer = null }
      unlisten()
      callback()
    }
    unlisten = channel.listen(data => {
      const reply = data as { action?: unknown; requestId?: unknown; success?: unknown; error?: unknown } | null | undefined
      if (!reply || reply.action !== action || reply.requestId !== requestId) return
      if (reply.success === true) settle(() => resolve(reply))
      else settle(() => reject(new Error(typeof reply.error === 'string' && reply.error ? reply.error : `${action} was refused`)))
    })
    timer = clock.setTimer(() => { timer = null; settle(() => reject(new Error('Command timeout'))) }, timeoutMs)
    channel.post({ action, params, requestId })
  })
}

export type RestoreFlushResult =
  | { ok: true; flushed: boolean }
  | { ok: false; reason: 'ack' | 'unsaved'; message: string }

export const RESTORE_NOT_SAVED_MESSAGE = 'Your latest edits could not be saved first, so the version was not restored. Try again.'

/**
 * Makes sure nothing is pending before the restore command is sent.
 *   - the last status Studio saw is clean, or Studio has seen none (a frame that just loaded reports "saved" itself): nothing to flush;
 *   - otherwise: arm the wait for a clean save, send forceSave and wait for its acknowledgement, then wait for the clean save.
 * The wait is armed BEFORE the command goes out, so a save that finishes at once cannot be missed.
 */
export async function flushViewerBeforeRestore(deps: {
  tracker: SaveStatusTracker
  /** The viewer's forceSave command; resolves on its acknowledgement, rejects when the viewer refuses or does not answer. */
  forceSave: () => Promise<unknown>
  saveTimeoutMs?: number
}): Promise<RestoreFlushResult> {
  const { tracker, forceSave, saveTimeoutMs = RESTORE_FLUSH_SAVE_TIMEOUT_MS } = deps
  const seen = tracker.last()
  if (seen === null || isCleanSaveEvent(seen)) return { ok: true, flushed: false }
  const clean = tracker.waitForClean(saveTimeoutMs)
  try {
    await forceSave()
  } catch {
    clean.cancel()
    return { ok: false, reason: 'ack', message: RESTORE_NOT_SAVED_MESSAGE }
  }
  if (await clean.promise) return { ok: true, flushed: true }
  return { ok: false, reason: 'unsaved', message: RESTORE_NOT_SAVED_MESSAGE }
}
