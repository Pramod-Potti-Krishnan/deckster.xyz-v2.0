/** Compact provenance from an owned Composer use result or Director sync. */
export interface ComposerAdoption {
  schema_version: 'composer-adoption-v1'
  template_id: string
  presentation_id: string
  frozen_theme: true
  /** Director's marker for a deck imported from a PowerPoint file (NEXT_PUBLIC_STUDIO_DECK_IMPORT's other half, composer_adoption.source). Absent for every other adoption. */
  source?: 'deck_import'
}

export interface ComposerThemeState {
  composerAdoption: ComposerAdoption | null
  composerThemeResolved: boolean
}

export function readComposerAdoption(value: unknown, presentationId: string | null | undefined): ComposerAdoption | null {
  if (!value || typeof value !== 'object' || !presentationId) return null
  const marker = value as Partial<ComposerAdoption>
  if (marker.schema_version !== 'composer-adoption-v1' || marker.frozen_theme !== true ||
      typeof marker.template_id !== 'string' || !marker.template_id || marker.presentation_id !== presentationId) return null
  return { schema_version: marker.schema_version, template_id: marker.template_id, presentation_id: presentationId, frozen_theme: true, ...(marker.source === 'deck_import' ? { source: 'deck_import' as const } : {}) }
}

/** A malformed marker or blocked URL must never unlock a theme mutation. */
export function composerThemeFromSync(value: unknown, presentationId: string | null | undefined, urlBlocked: boolean): ComposerThemeState {
  const composerAdoption = readComposerAdoption(value, presentationId)
  return { composerAdoption, composerThemeResolved: !urlBlocked && (value === undefined || composerAdoption !== null) }
}

/** Wait for this connection's sync before considering a cached deck mutable. */
export function composerThemeSyncBlocked(enabled: boolean, state: ComposerThemeState, presentationId: string | null | undefined): boolean {
  return enabled && (!state.composerThemeResolved || Boolean(presentationId && state.composerAdoption?.presentation_id === presentationId))
}
