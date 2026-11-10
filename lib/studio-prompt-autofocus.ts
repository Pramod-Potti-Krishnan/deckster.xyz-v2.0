/**
 * PASS2B batch 2 (J3-02): when an Add Element form opened, nothing focused the "Generation prompt" box, and closing the Radix menu that was used to
 * pick the element handed focus back to the Add Element button, so the first keystroke went nowhere (Add Slide already focuses its box). Flag
 * NEXT_PUBLIC_STUDIO_PROMPT_AUTOFOCUS, exact 'true', default off; off is today's panel exactly.
 *
 * On: for every new activation of a NEW element (panel mode 'generate') the prompt box takes focus, but only after the picking menu is gone and
 * Radix has restored focus to its trigger (Radix does that from a timer queued when the menu content unmounts, which with an exit animation is later
 * than the click), and never over focus the person already placed:
 * - not in edit or refine mode (the box there holds text the person may only want to read);
 * - not when the box is gone, disabled, read-only or aria-disabled (a generating element, a preset shape whose box is not read);
 * - not when focus is already inside the panel (the person is on a field of it), in another text field, or inside an open menu / dialog / listbox;
 * - not in a hidden Studio drawer (those stay mounted, like the panel's own window shortcuts which skip them).
 *
 * Pure apart from the timers it is handed through the textarea's own document/window: no React, no network.
 */

export const STUDIO_PROMPT_AUTOFOCUS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PROMPT_AUTOFOCUS === 'true'

/** How often the wait for the picking menu to leave the page is retried, how long it is awaited at most, and the pause after it left. */
export const AUTOFOCUS_POLL_MS = 40
export const AUTOFOCUS_MAX_WAIT_MS = 1000
export const AUTOFOCUS_SETTLE_MS = 60

/** A Radix menu content (DropdownMenuContent renders role="menu"), also while it plays its exit animation. */
const OPEN_MENU_SELECTOR = '[role="menu"]'
const HIDDEN_DRAWER_SELECTOR = '[data-studio-v4-shell="true"] [data-studio-workspace-visible="false"]'
const OVERLAY_SELECTOR = '[role="menu"],[role="dialog"],[role="alertdialog"],[role="listbox"]'

export interface PromptAutofocusInput {
  /** Defaults to the flag; a test may pass it. */
  enabled?: boolean
  isOpen: boolean
  mode: 'generate' | 'edit' | 'refine'
  /** The panel shows its prompt box (generate / refine). */
  showsPromptBox: boolean
  /** The id of the activation (a new element target); changes when a new target is picked. */
  activationId: string | number
  elementType: string
}

/**
 * The key the prompt box is to be focused for, or undefined when it is not to be focused at all. The box's effect re-runs when the key changes, so a
 * new activation (or a reopen: open -> undefined -> key) schedules one focus, and a close cancels a pending one. Always undefined with the flag off.
 */
export function promptAutofocusKey(input: PromptAutofocusInput): string | undefined {
  if (!(input.enabled ?? STUDIO_PROMPT_AUTOFOCUS_ENABLED)) return undefined
  if (!input.isOpen || input.mode !== 'generate' || !input.showsPromptBox) return undefined
  return `${input.activationId}:${input.elementType}`
}

/** The slice of an element this module reads (so a test can hand it plain objects). */
export interface FocusableLike {
  tagName?: string
  isContentEditable?: boolean
  closest?(selector: string): unknown
  contains?(other: never): boolean
  getAttribute?(name: string): string | null
  disabled?: boolean
  readOnly?: boolean
  focus?(options?: { preventScroll?: boolean }): void
  ownerDocument?: DocumentLike | null
}
export interface DocumentLike {
  activeElement?: FocusableLike | null
  body?: unknown
  querySelector?(selector: string): unknown
  defaultView?: WindowLike | null
}
export interface WindowLike {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: never): void
}

function isEditable(element: FocusableLike): boolean {
  const tag = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true
}

/**
 * Whether the prompt box may take focus right now (read at the moment of focusing, not when scheduled: the form registers its controls, a Shape
 * its preset, after the panel mounted).
 */
export function promptBoxMayTakeFocus(box: FocusableLike | null | undefined): boolean {
  if (!box || typeof box.focus !== 'function') return false
  if (box.disabled === true || box.readOnly === true || box.getAttribute?.('aria-disabled') === 'true') return false
  if (box.closest?.(HIDDEN_DRAWER_SELECTOR)) return false
  const active = box.ownerDocument?.activeElement
  if (!active || active === box.ownerDocument?.body) return true
  // Focus inside the panel already (its header, a chip, a field): the person is there; leave it. The panel is the nearest element carrying the
  // Studio panel marker, falling back to the box's own form block.
  const panel = box.closest?.('[data-studio-v4-panel="element-generation"]')
  if (panel && (panel as FocusableLike).contains?.(active as never)) return false
  if (isEditable(active)) return false
  if (active.closest?.(OVERLAY_SELECTOR)) return false
  return true
}

/**
 * Focuses the box once the picking menu has left the page and Radix has had its turn: polls for an open menu every AUTOFOCUS_POLL_MS (at most
 * AUTOFOCUS_MAX_WAIT_MS, so an unrelated menu never blocks it for long), waits AUTOFOCUS_SETTLE_MS after the last menu is gone (Radix restores
 * focus to the trigger from a zero-delay timer queued when the menu unmounts), then focuses if promptBoxMayTakeFocus. Returns the cancel function.
 */
export function schedulePromptFocus(getBox: () => FocusableLike | null | undefined): () => void {
  const first = getBox()
  const view = first?.ownerDocument?.defaultView
  if (!first || !view) return () => {}
  let handle: unknown
  let waited = 0
  const settle = () => {
    handle = undefined
    const box = getBox()
    if (promptBoxMayTakeFocus(box)) box!.focus!({ preventScroll: true })
  }
  const poll = () => {
    handle = undefined
    const box = getBox()
    if (!box) return
    if (waited < AUTOFOCUS_MAX_WAIT_MS && box.ownerDocument?.querySelector?.(OPEN_MENU_SELECTOR)) {
      waited += AUTOFOCUS_POLL_MS
      handle = view.setTimeout(poll, AUTOFOCUS_POLL_MS)
      return
    }
    handle = view.setTimeout(settle, AUTOFOCUS_SETTLE_MS)
  }
  handle = view.setTimeout(poll, 0)
  return () => {
    if (handle !== undefined) view.clearTimeout(handle as never)
    handle = undefined
  }
}
