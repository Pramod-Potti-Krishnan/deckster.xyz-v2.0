/** Caller-observed readiness and risks. Unknown values never establish safe entry. */
export interface StudioIntroEligibilityInput {
  workspaceReady: boolean | null | undefined
  initialEntry: boolean | null | undefined
  activeBuild: boolean | null | undefined
  decisionPending: boolean | null | undefined
  errorPresent: boolean | null | undefined
  modalOpen: boolean | null | undefined
  dirtyDraft: boolean | null | undefined
  workInFlight: boolean | null | undefined
}

/** Current eligibility only. The owner handles first-entry consumption and explicit replay. */
export function studioIntroEligibility(input: StudioIntroEligibilityInput): {
  automatic: boolean
  manual: boolean
} {
  const manual = input.workspaceReady === true
    && input.activeBuild === false
    && input.decisionPending === false
    && input.errorPresent === false
    && input.modalOpen === false
    && input.dirtyDraft === false
    && input.workInFlight === false
  return { automatic: manual && input.initialEntry === true, manual }
}
