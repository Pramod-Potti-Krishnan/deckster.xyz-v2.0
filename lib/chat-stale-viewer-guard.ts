/**
 * FRONTEND-2 (B43, 28 Oct; E2E-2 batch 2 rows 34, 35, 36, Studio dev, deck 017fa691, 21:42-22:07Z): a chat element ADD or EDIT after a server-side chat deck change (/add-slide, /duplicate, /delete, /undo, a refine, all done by Director on
 * Layout) must land on the slide the directive means, or say so; "Reload deck" must recover. NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD, exact "true", default off, read at build time. Off: nothing here runs.
 *
 * What the real code does (Layout read-only at layout-builder frontend2/layout-targeted-save; Studio at frontend2/chat-add-targeted):
 *   1. The viewer in the iframe is a snapshot. Director changes the stored deck through Layout's routes; the viewer is not told unless Studio reloads it (S-03's deck_mutation refresh is its own flag, and an undo, a refine
 *      and a second tab never reach it). A chat add then inserts into the VIEWER's slide at Director's index and the editor's autosave PUTs /api/presentations/{id}/slides: server.py update_all_slides applies slides[i] of the body to the stored
 *      slide i BY INDEX, wholesale per collection, with no slide id, no version and no deck-changed check. Layout answers 200 and writes the old deck's slides over the new one (measured, scripts/test-studio-chat-stale-viewer-guard.mjs: after
 *      an add-slide in the middle the new slide holds the old slide's layout text and the chat element is on the neighbour). It is never a refusal. The "Save interrupted ... select this message to retry" of E2E-2 is auto-save.js saveError's text for a
 *      TypeError ("Failed to fetch"), i.e. a request the browser never sent (Layout's GET showed no change); the one path that does that and also cancels the pending debounced save is the unload / hidden-tab flush (flushPendingChanges {keepalive:true}:
 *      Chromium refuses a keepalive body over 64 KiB, and a whole-deck body passes that at about ten slides, as auto-save.js itself says at KEEPALIVE_BODY_BUDGET). That status, 'error', is what Studio keeps (point 2).
 *   2. components/presentation-viewer.tsx keeps the last `saveStatus` the viewer posted in React state, written only by the viewer's save messages and handleForceSave. A viewer reload (Reload deck, a refresh token on the viewer URL) loads a NEW document that
 *      posts nothing until something is edited, so 'error' stays; getStudioIntroductionSafety().error is true, captureStudioElementGeneration() returns null, and hooks/use-textlabs-generation.ts answers "The presentation viewer is not ready." for every
 *      later add, until the whole page is reloaded (which re-creates the state). "Reload anyway" drops the unsaved element but not the flag.
 *   3. #546 (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE) PUTs .../slides/{index}/elements/{id}/chat-save with the slide_id of the viewer's slide that holds the element; Layout (chat_targeted_save.py apply_element_save) answers 409 SLIDE_CHANGED when the
 *      stored slide at that index has another id. A stale viewer therefore cannot put the element on the wrong slide (the add fails, honestly); it can only fail. A viewer section with no data-slide-id (a slide stored with no id) sends null and is not checked.
 *
 * With the flag on, before a chat add or a chat edit runs (this module, called from app/builder/page.tsx's two dispatch points):
 *   - the viewer's slide ids (composeGetState, the compose API Studio already uses) are compared with Layout's own (its slide inventory, the read #538 uses). Equal: nothing else happens. Different: the viewer is reloaded onto the server's deck (the page's Reload deck),
 *     and the directive runs only once it is ready and equal. It is never reloaded over edits it holds that are not saved (the user's own work): then the directive is refused, in the existing error vocabulary
 *     (an add: status failed with the sentence; an edit: ok:false with SLIDE_CHANGED or VIEWER_NOT_READY), and nothing is changed.
 *   - an add is "Done" (an inserted result: Director says "the element is on slide N" only for it) only once it is stored: by #546's confirmed targeted save, or, on the editor's autosave path, after the viewer's save acknowledgement
 *     (hooks/use-textlabs-generation.ts, requireChatAddSaved); a save that errors, never answers, or never started fails the add (status failed, the sentence in `error`: the add result has no error code). An edit already answers ok only after the ack (#522) or the targeted commit (#540).
 *   - the viewer's remembered 'error' ends with the document it came from (presentation-viewer.tsx handleIframeLoad), so Reload deck recovers.
 * Manual editing is not touched (PROD-LATER). Plain node: this file imports nothing.
 */

export const CHAT_STALE_VIEWER_GUARD_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD === 'true'

/** How long the viewer gets to load the server's deck after a reload, and how often it is asked. */
export const STALE_GUARD_RELOAD_TIMEOUT_MS = 25_000
export const STALE_GUARD_POLL_MS = 400
/** A chat add that the editor's autosave stores: the budget for the viewer's acknowledgement (autosave's debounce 2.5 s, then up to 3 tries a second apart). */
export const CHAT_ADD_SAVE_TIMEOUT_MS = 20_000

export const STALE_GUARD_MESSAGES = {
  unread: "Studio could not read the deck from Layout, so the element was not added. Nothing was changed. Try again.",
  notReady: 'The presentation viewer is not ready, so the element was not added. Nothing was changed. Wait for it to load and try again.',
  busy: 'The presentation viewer is busy (a save or a slide change is still running), so the element was not added. Nothing was changed. Try again in a moment.',
  unsaved: 'The deck was changed in chat, and this tab still holds edits that are not saved. Reloading would drop them, so nothing was added. Save changes now, or use Reload deck, then try again.',
  saveFailed: 'A save in this tab failed earlier and its edits are still unsaved, so nothing was added. Use Save changes now, or Reload deck, then try again.',
  didNotReload: 'The presentation viewer did not show the changed deck in time, so nothing was added. Use Reload deck, then try again.',
  addNotSaved: 'The new element was added on screen but the save did not land, so it was not kept. Nothing else in the deck was changed. Try again.',
} as const

export type StaleGuardCode = 'VIEWER_NOT_READY' | 'SLIDE_CHANGED'
export type StaleGuardVerdict =
  | { status: 'fresh' }
  | { status: 'unverified' }
  | { status: 'reloaded' }
  | { status: 'owner-changed' }
  | { status: 'refused'; code: StaleGuardCode; message: string }

/** What the viewer says of its own slides: ids in order, 'busy' while a slide is being composed into it, null when it states no usable identity. */
export type ViewerSlideRead = ReadonlyArray<string> | 'busy' | null
export type ViewerSaveState = 'saved' | 'unsaved' | 'saving' | 'error' | null

export interface StaleGuardDeps {
  /** Layout's slide ids for the shown deck in order (its slide inventory); null when Layout has no inventory (the check cannot be made); throws when the read failed. */
  readServerSlideIds: () => Promise<ReadonlyArray<string> | null>
  /** The viewer's own slides (composeGetState); throws while the viewer is not ready (no iframe, a command that timed out). */
  readViewerSlideIds: () => Promise<ViewerSlideRead>
  /** The last save status the viewer posted (null: the viewer has none). */
  viewerSaveState: () => ViewerSaveState
  /** getStudioIntroductionSafety().busy (a save, a slide mutation, a compose job). */
  viewerBusy: () => boolean
  /** The page's Reload deck (a new refresh token on the viewer URL and the rail's re-read). */
  reloadViewer: () => void
  /** The directive's owner is still the one on screen. */
  owns: () => boolean
  wait: (ms: number) => Promise<void>
  now: () => number
  timeoutMs?: number
  pollMs?: number
}

const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) => a.length === b.length && a.every((id, index) => id === b[index])

/**
 * Decides whether the viewer shows the server's deck and, when it does not, brings it there. Never reloads over unsaved work, never while the viewer is busy, and never answers `fresh` or `reloaded` unless the two id lists were seen equal.
 */
export async function ensureViewerMatchesServer(deps: StaleGuardDeps): Promise<StaleGuardVerdict> {
  const budget = deps.timeoutMs ?? STALE_GUARD_RELOAD_TIMEOUT_MS
  const poll = deps.pollMs ?? STALE_GUARD_POLL_MS
  const started = deps.now()
  const left = () => budget - (deps.now() - started)
  const refuse = (code: StaleGuardCode, message: string): StaleGuardVerdict => ({ status: 'refused', code, message })
  const gone = (): StaleGuardVerdict | null => (deps.owns() ? null : { status: 'owner-changed' })

  // 1. what Layout holds
  let server: ReadonlyArray<string> | null
  try { server = await deps.readServerSlideIds() } catch { return gone() ?? refuse('VIEWER_NOT_READY', STALE_GUARD_MESSAGES.unread) }
  if (gone()) return { status: 'owner-changed' }
  if (!server) return { status: 'unverified' } // Layout has no inventory: today's behaviour
  // 2. what the viewer shows (it may still be loading: wait for it, within the budget)
  let viewer: ViewerSlideRead = null
  for (;;) {
    try { viewer = await deps.readViewerSlideIds(); break } catch {
      if (left() <= 0) return gone() ?? refuse('VIEWER_NOT_READY', STALE_GUARD_MESSAGES.notReady)
      await deps.wait(poll)
      if (gone()) return { status: 'owner-changed' }
    }
  }
  if (viewer === null) return { status: 'unverified' } // the viewer states no slide identity (a slide stored with no id): today's behaviour
  if (viewer !== 'busy' && sameIds(viewer, server)) {
    // the same deck. A save that failed earlier still stands in the way of the add (its status is why the viewer would say "not ready"): say so.
    return deps.viewerSaveState() === 'error' ? refuse('VIEWER_NOT_READY', STALE_GUARD_MESSAGES.saveFailed) : { status: 'fresh' }
  }
  // 3. a different deck (or a viewer still composing a slide): not over unsaved edits, not while busy
  for (;;) {
    const state = deps.viewerSaveState()
    if (state === 'error') return refuse('SLIDE_CHANGED', STALE_GUARD_MESSAGES.unsaved)
    if (state !== 'unsaved' && state !== 'saving' && !deps.viewerBusy()) break
    if (left() <= 0) return refuse(state === 'unsaved' || state === 'saving' ? 'SLIDE_CHANGED' : 'VIEWER_NOT_READY', state === 'unsaved' || state === 'saving' ? STALE_GUARD_MESSAGES.unsaved : STALE_GUARD_MESSAGES.busy)
    await deps.wait(poll)
    if (gone()) return { status: 'owner-changed' }
  }
  if (viewer === 'busy') return refuse('VIEWER_NOT_READY', STALE_GUARD_MESSAGES.busy)
  deps.reloadViewer()
  // 4. wait for the viewer to show the server's deck
  for (;;) {
    await deps.wait(poll)
    if (gone()) return { status: 'owner-changed' }
    try {
      const again = await deps.readServerSlideIds()
      const shown = await deps.readViewerSlideIds()
      if (gone()) return { status: 'owner-changed' }
      if (again && shown && shown !== 'busy' && sameIds(shown, again)) return { status: 'reloaded' }
    } catch { /* still loading */ }
    if (left() <= 0) return gone() ?? refuse('VIEWER_NOT_READY', STALE_GUARD_MESSAGES.didNotReload)
  }
}

// ---- the page's two dispatch points ---------------------------------------------------------------------------------------------------

export interface GuardedAddPayload { directive_id: string }
export interface GuardedEditMessage { payload?: { directive_id?: unknown } | null; directive_id?: unknown }

export interface ChatStaleViewerGuardDeps<P extends GuardedAddPayload, M extends GuardedEditMessage, O extends { isCurrent: () => boolean }> {
  ensure: (owns: () => boolean) => Promise<StaleGuardVerdict>
  /** The owner on screen, as the add runner reads it (a record compared by its fields); null when none. */
  addOwner: () => { sessionId: string | null; deckOwnerSessionId: string | null; presentationId: string | null; epoch: number } | null
  /** The add runner's own refusal for an open element draft: the guard stays out of its way (it answers "dismissed" itself). */
  addPanelBusy: () => boolean
  runAdd: (payload: P) => void
  reportAddFailed: (payload: P, error: string) => void
  runEdit: (message: M, owner: O) => void
  reportEditFailed: (directiveId: string, code: StaleGuardCode) => void
}

export interface ChatStaleViewerGuard<P extends GuardedAddPayload, M extends GuardedEditMessage, O extends { isCurrent: () => boolean }> {
  add: (payload: P) => void
  edit: (message: M, owner: O) => void
}

const directiveIdOf = (message: GuardedEditMessage): string | null => {
  const raw = message?.payload && typeof message.payload === 'object' ? message.payload.directive_id : message?.directive_id
  return typeof raw === 'string' && raw.trim() ? raw : null
}

/**
 * The guard in front of the page's add runner and edit runner. `getDeps` is read when a directive arrives and again when it is handed on, so the runners are the closures of the LATEST render (a viewer reload changes the lease the generation takes).
 * One check at a time (a directive that arrives while one runs waits for it, so the viewer is not reloaded twice). A directive the check refused is answered once.
 */
export function createChatStaleViewerGuard<P extends GuardedAddPayload, M extends GuardedEditMessage, O extends { isCurrent: () => boolean }>(
  getDeps: () => ChatStaleViewerGuardDeps<P, M, O>,
): ChatStaleViewerGuard<P, M, O> {
  let running: Promise<unknown> = Promise.resolve()
  const answered = new Set<string>()
  const once = (id: string) => { if (answered.has(id)) return false; answered.add(id); if (answered.size > 200) { const oldest = answered.values().next().value; if (oldest !== undefined) answered.delete(oldest) } return true }
  const queue = <T,>(job: () => Promise<T>): Promise<T> => { const next = running.then(job, job); running = next.catch(() => undefined); return next }
  return {
    add(payload) {
      const first = getDeps()
      if (first.addPanelBusy()) { first.runAdd(payload); return }
      const start = first.addOwner()
      const owns = () => {
        const now = getDeps().addOwner()
        return Boolean(start && start.sessionId && start.presentationId && now && now.sessionId === start.sessionId && now.deckOwnerSessionId === start.sessionId
          && now.presentationId === start.presentationId && now.epoch === start.epoch)
      }
      void queue(() => first.ensure(owns)).then(verdict => {
        if (verdict.status === 'owner-changed' || !owns()) return // the add runner's own rule: a directive for an owner no longer on screen is not answered
        if (verdict.status === 'refused') { if (once(payload.directive_id)) getDeps().reportAddFailed(payload, verdict.message); return }
        getDeps().runAdd(payload)
      }, () => { if (owns()) getDeps().runAdd(payload) })
    },
    edit(message, owner) {
      const id = directiveIdOf(message)
      const owns = () => owner.isCurrent()
      void queue(() => getDeps().ensure(owns)).then(verdict => {
        if (verdict.status === 'owner-changed' || !owns()) return
        if (verdict.status === 'refused') { if (id && once(id)) getDeps().reportEditFailed(id, verdict.code); return }
        getDeps().runEdit(message, owner)
      }, () => { if (owns()) getDeps().runEdit(message, owner) })
    },
  }
}

// ---- an add the editor's autosave stores ----------------------------------------------------------------------------------------------

/** The shape of lib/chat-element-edit-save.ts SaveWatch this needs (so this file imports nothing). */
export interface AddSaveWatch {
  tracked: () => boolean
  settled: (timeoutMs: number) => Promise<'saved' | 'error' | 'timeout'>
  close: () => void
}

/**
 * Called by the generation hook after a chat add's insert. "Done" (an inserted result: Director says "the element is on slide N" only for it) needs the element stored in Layout:
 *   - `storedOnItsOwn`: #546's targeted save stored it and its commit confirmed it (it threw otherwise): nothing more to wait for;
 *   - otherwise the viewer's own autosave must have taken the change (it posted unsaved or saving since the watch opened) and must post saved with nothing pending. An error, no answer in the budget, or a change the autosave never took
 *     (the viewer was not in edit mode: Layout drops it) throws, the hook removes the element and the runner answers failed, never inserted.
 */
export async function requireChatAddSaved(watch: AddSaveWatch, options: { storedOnItsOwn: boolean; timeoutMs?: number }): Promise<void> {
  if (options.storedOnItsOwn) { watch.close(); return }
  if (!watch.tracked()) { watch.close(); throw new Error(STALE_GUARD_MESSAGES.addNotSaved) }
  const outcome = await watch.settled(options.timeoutMs ?? CHAT_ADD_SAVE_TIMEOUT_MS)
  watch.close()
  if (outcome !== 'saved') throw new Error(STALE_GUARD_MESSAGES.addNotSaved)
}
