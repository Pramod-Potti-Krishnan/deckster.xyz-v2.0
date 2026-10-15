/**
 * PASS2B batch 2 (J5-09): the "Save as Template" dialog's Save button went grey for four different reasons (no name, no session, no built deck, a
 * request in flight) and said nothing: the toasts "Name required" / "No deck to save" / "No completed deck to save" cannot fire while the button is
 * disabled. Flag NEXT_PUBLIC_STUDIO_TEMPLATE_SAVE_REASONS, exact 'true', default off; off is today's dialog exactly.
 *
 * On: the first unmet reason is shown as a line under the Save button and the button is described by it (aria-describedby). The reason exists
 * exactly when the button's own `disabled` expression is true (templateSaveDisabled below is that expression, and the dialog's `disabled` stays the
 * very same text), checked in the order name, session, source deck, loading.
 *
 * Pure: no React, no DOM, no network.
 */

export const STUDIO_TEMPLATE_SAVE_REASONS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_SAVE_REASONS === 'true'

export const TEMPLATE_SAVE_REASON_NAME = 'Add a name to save this template.'
export const TEMPLATE_SAVE_REASON_SESSION = 'Open a deck to save it as a template.'
export const TEMPLATE_SAVE_REASON_SOURCE = 'Finish building the deck before saving it as a template.'
export const TEMPLATE_SAVE_REASON_LOADING = 'Loading…'

export interface TemplateSaveState {
  name: string
  sessionId: string | null | undefined
  sourcePresentationId: string | null | undefined
  loading: boolean
}

/** The dialog's own disabled rule for the Save button (the same expression, kept here so a test can compare the two). */
export function templateSaveDisabled(state: TemplateSaveState): boolean {
  return state.loading || !state.name.trim() || !state.sessionId || !state.sourcePresentationId
}

/** The first unmet reason, or null when Save is enabled. Always null with the flag off. */
export function templateSaveReason(state: TemplateSaveState, enabled: boolean = STUDIO_TEMPLATE_SAVE_REASONS_ENABLED): string | null {
  if (!enabled) return null
  if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME
  if (!state.sessionId) return TEMPLATE_SAVE_REASON_SESSION
  if (!state.sourcePresentationId) return TEMPLATE_SAVE_REASON_SOURCE
  if (state.loading) return TEMPLATE_SAVE_REASON_LOADING
  return null
}
