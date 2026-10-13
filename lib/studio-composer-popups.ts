// PASS2-COMPOSER-POPUPS (flag NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2, exact "true", Studio shell only, default off).
// Pure helpers for the composer's popups. Nothing here reads the environment or touches a handler: the composer decides whether the flag is
// on, and passes the answers in.

/** The composer popups that share one open-state. (Attach opens a file dialog, not a popup; it just closes whichever popup is open.) */
export type ComposerPopupId = 'template' | 'theme' | 'research'

/**
 * The shared open-state after popup `id` asks to open (`open` true) or close (`open` false).
 * Opening a popup replaces whichever other popup was open; closing only ever closes the popup that asked, so a late close from a popup that
 * has already been replaced cannot close its replacement.
 */
export function nextComposerPopup(current: ComposerPopupId | null, id: ComposerPopupId, open: boolean): ComposerPopupId | null {
  if (open) return id
  return current === id ? null : current
}

/**
 * A composer popup closes on Escape, but while a dropdown list inside it is open the first Escape belongs to that list (it closes the list and
 * leaves the popup); the next Escape closes the popup. `active` is the focused element: a combobox whose list is expanded.
 */
export function escapeBelongsToDropdownList(active: Element | null | undefined): boolean {
  return !!active && active.getAttribute('role') === 'combobox' && active.getAttribute('aria-expanded') === 'true'
}

/** Radix `onEscapeKeyDown` for a composer popup that holds dropdowns: leave the popup open when the Escape is for an open list. */
export function keepPopupOpenForDropdownList(event: { preventDefault: () => void }): void {
  if (typeof document !== 'undefined' && escapeBelongsToDropdownList(document.activeElement)) event.preventDefault()
}

/** Deckster-provided templates. No catalog exists in the product yet (the template service lists only a user's own templates), so this is empty. */
export type DecksterTemplateOption = { id: string; name: string; description?: string; slideCount?: number }
export const DECKSTER_PROVIDED_TEMPLATES: readonly DecksterTemplateOption[] = []
