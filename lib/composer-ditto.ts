/**
 * Stage 1B gate G3, "Rebuild from own content" (ditto). Import-free.
 * Director accepts {session_id, mode: "ditto"} on templates/{id}/use (flag COMPOSER_STAGE1B_DITTO_ENABLED)
 * and rebuilds the deck from the template's own content with no model calls.
 */
export const COMPOSER_DITTO_MODE = 'ditto'

/** Keys the `templates/{id}/use` proxy forwards. Flag off: today's two keys, so `mode` is refused. */
export function composerUseKeys(dittoEnabled: boolean): string[] {
  return dittoEnabled ? ['session_id', 'brief', 'mode'] : ['session_id', 'brief']
}

/** Flag on: `mode`, when present, must be the literal "ditto" and must not travel with a brief (Director answers 422). */
export function composerUseModeAllowed(payload: { mode?: unknown; brief?: unknown }): boolean {
  return payload.mode === undefined || payload.mode === COMPOSER_DITTO_MODE && payload.brief === undefined
}
