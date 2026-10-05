/** An existing caller-owned epoch, retired on account/session/navigation/version
 * intent. Identity equality is deliberate: equal strings do not revive an owner. */
export interface StudioInitialStageTarget {
  readonly owner: object
  readonly presentationId: string | null
  readonly presentationUrl: string | null
  readonly activeVersion: 'blank' | 'strawman' | 'final'
}

export interface StudioInitialStageAdmissionInput {
  enabled: boolean
  selected: StudioInitialStageTarget | null
  /** Positive provenance from the branch that actually selected an automatic
   * presentation_init / legacy is_blank target. Never populate from a restore,
   * viewer URL, count, absent outline, or a greeting. */
  automaticBlankTarget: StudioInitialStageTarget | null
  /** Existing lifecycle/URL authorities supply these; unknown preserves native. */
  hasOwnedSelection: boolean | null | undefined
  viewerUrlAllowed: boolean | null | undefined
  initialStageEligible: boolean | null | undefined
  /** Include restored/unknown authored content, template/composer overrides,
   * native edits, save/recovery and native work in flight. Chat draft alone is
   * not native work; retain it and its existing introduction veto independently. */
  nativeWorkPresent: boolean | null | undefined
  /** Include genuine service/build/viewer errors. This helper must never mask
   * a diagnostic or replace a recovery surface with decorative imagery. */
  errorPresent: boolean | null | undefined
  /** Sticky per-owner admission, set only on the committed native mount (or
   * an existing mounted target). Keep it until that owner is retired. */
  admittedNativeOwner: object | null
  /** Explicit blank-canvas intent, recorded synchronously before rendering. */
  explicitBlankOwner: object | null
}

function present(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Presentation-only admission before the FIRST native mount. true means the
 * caller may render its approved initial stage instead of the native viewer.
 * false leaves the existing rendering/lifecycle/gates untouched. This neither
 * chooses a presentation nor changes URLs, counts, owner epochs, completion,
 * approvals, save state, toolbar capabilities or the decorative introduction. */
export function shouldDeferStudioInitialNative(input: StudioInitialStageAdmissionInput): boolean {
  if (input.enabled !== true || input.hasOwnedSelection !== true
    || input.viewerUrlAllowed !== true || input.initialStageEligible !== true
    || input.nativeWorkPresent !== false || input.errorPresent !== false) return false

  const selected = input.selected
  const automatic = input.automaticBlankTarget
  if (!selected || !automatic || selected.activeVersion !== 'blank'
    || automatic.activeVersion !== 'blank' || selected.owner !== automatic.owner
    || !present(selected.presentationId) || !present(selected.presentationUrl)
    || selected.presentationId !== automatic.presentationId
    || selected.presentationUrl !== automatic.presentationUrl) return false

  return input.admittedNativeOwner !== selected.owner && input.explicitBlankOwner !== selected.owner
}
