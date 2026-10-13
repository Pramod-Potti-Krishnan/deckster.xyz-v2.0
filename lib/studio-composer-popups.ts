// PASS2-COMPOSER-POPUPS (flag NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2, exact "true", Studio shell only, default off).
// Pure helpers for the composer's popups. Nothing here reads the environment or touches a handler: the composer decides whether the flag is
// on, and passes the answers in. The one request is `loadComposerTemplates`, the composer library's list (the library dialog's own request).
import { composerRequest, type ComposerTemplate } from './composer-library'

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

// ---- PASS2-COMPOSER-POPUPS fix: the template popup lists the composer library's templates --------------------------------------------------
// With the flag on, "My templates" is the composer library's own list (the uploads the library dialog shows), and a template there has the
// library dialog's actions. The popup only reads the list; every action is run by the library dialog itself, through its own handlers.

/** The library dialog's actions on one of its templates. */
export type ComposerTemplateAction = 'use' | 'ditto' | 'new-topic'

/** An action picked in the template popup, handed to the library dialog to run. `template` is a record of the same list the dialog shows. */
export interface ComposerLibraryRequest { action: ComposerTemplateAction; template: ComposerTemplate }

/** The actions the library dialog offers on a template, with its labels, in its order, behind the same flags (read by the caller). */
export function composerTemplateActions(enabled: { ditto: boolean; newTopic: boolean }): { action: ComposerTemplateAction; label: string }[] {
  return [
    { action: 'use', label: 'Use original' },
    ...(enabled.ditto ? [{ action: 'ditto' as const, label: 'Rebuild from own content' }] : []),
    ...(enabled.newTopic ? [{ action: 'new-topic' as const, label: 'New topic' }] : []),
  ]
}

/** The slide count the library dialog shows for a template. */
export function composerTemplateSlideCount(template: ComposerTemplate): number {
  return template.stage_template_summary?.slide_count ?? template.slide_count ?? 0
}

/** The composer library's list: the request the library dialog makes when it opens (`composerRequest('templates')`), read the same way. */
export async function loadComposerTemplates(): Promise<ComposerTemplate[]> {
  const response = await composerRequest<{ templates: ComposerTemplate[] }>('templates')
  return response.templates || []
}

/**
 * Where "Template library" goes: 'dialog' (the composer library dialog, the working library wherever the composer library is enabled),
 * 'page' (the Templates page, /studio/templates) or null (no link).
 * The Templates page is linked only where it works: unless NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED is "true" it says "Saved templates are not
 * enabled in this environment", so `templatesPage` is false and it is never the target. The template workspace
 * (NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE) is never the target either: it has no live event source yet and waits in its "converting" state.
 */
export type TemplateLibraryTarget = 'dialog' | 'page' | null
export function templateLibraryTarget(available: { composerLibrary: boolean; templatesPage: boolean }): TemplateLibraryTarget {
  return available.composerLibrary ? 'dialog' : available.templatesPage ? 'page' : null
}
