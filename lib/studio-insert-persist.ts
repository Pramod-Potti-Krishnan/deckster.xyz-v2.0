/**
 * INSERT-PERSIST (flag NEXT_PUBLIC_STUDIO_INSERT_PERSIST, exact "true", default off). P1 from E2E-1, 18 Oct: on a BLANK canvas, Shape and
 * Metrics inserts showed "Saved" but never reached Layout, and a Table insert came back after reload with its "Click to configure"
 * placeholder saved over it.
 *
 * Root cause (Layout uat @ 457c32d). Layout's autosave drops every change made while the viewer is not in edit mode:
 * src/utils/auto-save.js markContentChanged() returns early when `body[data-mode] !== 'edit'` unless `options.force` is set. insertTextBox
 * and deleteElement (src/utils/element-manager.js) call the non-forced triggerAutoSave; only upsertCitedElement / upsertSemanticElement call
 * triggerPersistentAutoSave (force) and forceSave. Studio's Add Element path never enters edit mode itself: it is entered only when the user
 * selects an element (presentation-viewer.tsx ensureEditMode). On a built deck the user has usually clicked something first, so inserts were
 * tracked (R8-3); on a blank canvas there is nothing to click, so:
 *   - Shape / Metrics (no citations) go through insertTextBox: change dropped, nothing pending, the indicator stays "Saved", nothing PUT.
 *   - Table goes through upsertCitedElement (forced): saved, together with the placeholder still on the slide at that moment; the
 *     placeholder's later deleteElement is dropped, so the saved slide keeps both.
 * The viewer's `forceSave` command cannot rescue this: with nothing pending, triggerSave() returns without a PUT.
 *
 * Fix: before Studio sends an element mutation whose persistence rides on the non-forced autosave, it makes sure the viewer is in edit
 * mode (isEditModeActive, then enterEditMode if needed) — exactly what selecting an element already does. Then the insert and the
 * placeholder delete are tracked and the debounced autosave PUTs them.
 *
 * Pure, no imports: the test loads this file on its own. Flag off: `shouldEnsureEditModeForPersistence` is false and nothing extra is sent.
 */
export const STUDIO_INSERT_PERSIST_ENABLED = process.env.NEXT_PUBLIC_STUDIO_INSERT_PERSIST === 'true'

/** Viewer element mutations whose save depends on Layout's edit-mode-gated triggerAutoSave (element-manager.js, uat @ 457c32d). */
export const AUTOSAVE_GATED_ELEMENT_ACTIONS: readonly string[] = [
  'insertTextBox',
  'insertTable',
  'insertChart',
  'insertImage',
  'insertInfographic',
  'insertDiagram',
  'upsertDiagram',
  'deleteElement',
]

export function shouldEnsureEditModeForPersistence(
  action: string,
  opts: { enabled: boolean; studioShell: boolean },
): boolean {
  return opts.enabled && opts.studioShell && AUTOSAVE_GATED_ELEMENT_ACTIONS.includes(action)
}

export type ViewerCommand = (action: string, params?: Record<string, unknown>) => Promise<{ isEditing?: unknown } | null | undefined>

/**
 * Puts the viewer in edit mode when it is not, so the next mutation is tracked by autosave. Returns whether the viewer reports editing
 * afterwards and whether this call entered it. Never throws: a failure here must not block the insert itself (it would only stay unsaved,
 * which is today's behaviour).
 */
export async function ensureViewerTracksEdits(send: ViewerCommand): Promise<{ editing: boolean; entered: boolean }> {
  try {
    const state = await send('isEditModeActive', {})
    if (state?.isEditing === true) return { editing: true, entered: false }
    const entered = await send('enterEditMode', {})
    return { editing: entered?.isEditing === true, entered: entered?.isEditing === true }
  } catch {
    return { editing: false, entered: false }
  }
}
