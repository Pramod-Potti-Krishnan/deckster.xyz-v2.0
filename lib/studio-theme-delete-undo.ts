// J4-01 (ELEMENT-2 PASS2B): NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO (exact "true"), default off.
//
// The composer's Build theme popover (Manage themes) deletes a saved theme on one click: no confirm, no undo, on a library shared by every
// deck. With the flag on, Delete only HIDES the theme and starts a 6 s undo window (an inline "Undo" in the popover plus the app's toast
// with an Undo action). Nothing is requested while the window is open:
//   - Undo (either one) restores the theme. No request was made, so nothing is written.
//   - The window running out hands the delete to the popover's own `onDelete` (ChatInput's runStudioThemeMutation('delete', id)), so the one
//     real request keeps every guard it already has (ownership, single in-flight mutation, acknowledgment, cache, reconciliation read).
//     It is sent WITH the id captured at click time: the theme that was deleted is the one deleted, even if the selection moved to another
//     saved theme while the popover was closed; a theme that is no longer in the library is a no-op, and a delete never clears a selection
//     that is some other theme.
//   - Choosing another theme / preset / brand colour in the popover while a delete is waiting commits it first (it is read from the
//     selection at that moment, so it must go before the selection moves).
//   - If the theme is no longer the selected one when the window ends and the popover is open, the delete is dropped, never redirected
//     to another theme.
//   - Closing the popover does NOT cancel: the window keeps running and the toast stays. Leaving the page (or a new account/session)
//     sends nothing: the timer dies with the page, and ChatInput refuses a mutation once it is unmounted or its owner changed. A theme
//     is therefore only ever deleted by an undo window that ran out while the page was alive. The failure mode is "the theme is still
//     there", which is recoverable; a delete that fires after the user could still undo it is not.
//
// This module holds the state machine only (no React, no toast); the popover supplies the toast and reads the snapshot.

export const STUDIO_THEME_DELETE_UNDO_ENABLED = process.env.NEXT_PUBLIC_STUDIO_THEME_DELETE_UNDO === 'true'
/** How long Undo is offered. */
export const STUDIO_THEME_DELETE_UNDO_MS = 6000
/** A committed delete stays hidden until its acknowledgment is seen; if none is ever seen the theme comes back after this. */
export const STUDIO_THEME_DELETE_SETTLE_MS = 10000

export interface ThemeDeleteSnapshot {
  /** The delete waiting out its undo window (hidden, undoable), or null. */
  readonly pending: { readonly id: string; readonly name: string } | null
  /** Ids whose delete was handed to ChatInput and has not been seen to finish (hidden, no longer undoable). */
  readonly committing: readonly string[]
}

/** What the open popover tells the store on every render. */
export interface ThemeDeleteAttachment {
  /** ChatInput's delete; called with the id captured when Delete was clicked (a bare call means the selected theme). */
  onDelete: (id?: string) => void
  /** The real (not hidden) selected saved-theme id. */
  selectedId: string | null
}

/** Shows the Undo toast; resolves a function that closes it (or null when none could be shown). */
export type ThemeDeleteNotify = (name: string, onUndo: () => void) => Promise<(() => void) | null>

export interface ThemeDeleteUndoDeps {
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

interface Entry { id: string; name: string; timer: unknown; closeToast: (() => void) | null }

export function createThemeDeleteUndo(deps: ThemeDeleteUndoDeps, windowMs = STUDIO_THEME_DELETE_UNDO_MS, settleMs = STUDIO_THEME_DELETE_SETTLE_MS) {
  const EMPTY: ThemeDeleteSnapshot = { pending: null, committing: [] }
  let snapshot: ThemeDeleteSnapshot = EMPTY
  let current: Entry | null = null
  let attached: ThemeDeleteAttachment | null = null
  let lastOnDelete: ((id?: string) => void) | null = null
  const settling = new Map<string, unknown>()
  const listeners = new Set<() => void>()

  const publish = () => {
    snapshot = current || settling.size
      ? { pending: current ? { id: current.id, name: current.name } : null, committing: [...settling.keys()] }
      : EMPTY
    listeners.forEach(listener => listener())
  }
  const closeWindow = (entry: Entry) => {
    deps.clearTimeout(entry.timer)
    entry.closeToast?.()
    entry.closeToast = null
    if (current === entry) current = null
  }
  const hold = (id: string) => {
    if (settling.has(id)) deps.clearTimeout(settling.get(id))
    settling.set(id, deps.setTimeout(() => release(id), settleMs))
  }
  const commit = (entry: Entry): boolean => {
    if (current !== entry) return false
    closeWindow(entry)
    // The popover is open and the selection has moved: never delete some other theme in its place.
    if (attached && attached.selectedId !== entry.id) { publish(); return false }
    const onDelete = attached?.onDelete ?? lastOnDelete
    if (!onDelete) { publish(); return false }
    hold(entry.id)
    publish()
    onDelete(entry.id) // the only place a delete request can start, and it names the theme
    return true
  }
  const release = (id: string) => {
    if (!settling.has(id)) return
    deps.clearTimeout(settling.get(id))
    settling.delete(id)
    publish()
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: (): ThemeDeleteSnapshot => snapshot,
    /** Hide the theme and open the undo window. An earlier waiting delete is committed first. */
    begin(id: string, name: string, notify?: ThemeDeleteNotify) {
      flush()
      const entry: Entry = { id, name, timer: null, closeToast: null }
      entry.timer = deps.setTimeout(() => { commit(entry) }, windowMs)
      current = entry
      publish()
      if (notify) {
        void notify(name, () => undo(entry)).then(close => {
          if (!close) return
          if (current === entry) entry.closeToast = close
          else close()
        }, () => {})
      }
    },
    /** Restore the waiting theme. Nothing was requested, so nothing is written. */
    undo,
    /** Commit a waiting delete now (used before a selection change). */
    flush,
    /** The open popover's latest handlers; called on every render. */
    attach(next: ThemeDeleteAttachment) { attached = next; lastOnDelete = next.onDelete },
    /** The popover closed: its selection is no longer known, its last onDelete is kept. */
    detach() { attached = null },
    /** The popover saw this id finish (gone from the list, or the delete's notice settled): stop hiding it. */
    release,
    /** Drop everything without a write (tests, account switch). */
    reset() {
      if (current) closeWindow(current)
      for (const handle of settling.values()) deps.clearTimeout(handle)
      settling.clear(); attached = null; lastOnDelete = null
      publish()
    },
  }

  function undo(entry: Entry | null = current): boolean {
    if (!entry || current !== entry) return false
    closeWindow(entry)
    publish()
    return true
  }
  function flush(): boolean {
    return current ? commit(current) : false
  }
}

export const themeDeleteUndo = createThemeDeleteUndo({
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
})
