// PASS2B G16 (flag NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD, default off). Import-free: the reason and when it applies.
//
// At the outline stage the Export menu was enabled although nothing is built yet (the base exports whatever the open deck is, and at stage 4 that is the
// outline's strawman); the accepted v4 mockup keeps Export disabled until a deck is built. Behind the flag Export stays disabled while the open deck is
// only the outline (builder stage 4, see lib/builder-presentation-ownership.ts deriveBuilderStage) and no final deck exists, and says why through the
// same disabled-reason box as the toolbar's greyed controls (components/studio-disabled-reason.tsx, PASS2B batch 1). A built deck (final present),
// a blank deck (stage 0) and every other stage keep the base's own enabled/disabled rule.

export const REASON_EXPORT_NEEDS_DECK = 'Export unlocks once your deck is built.'

/** Why Export is blocked, or null. `enabled` is the flag, already resolved by the caller; only a real `true` turns the gate on. */
export function studioExportBlockedReason(input: { enabled: boolean; stage: number; hasFinalDeck: boolean }): string | null {
  if (input.enabled !== true) return null
  return input.stage === 4 && input.hasFinalDeck !== true ? REASON_EXPORT_NEEDS_DECK : null
}
