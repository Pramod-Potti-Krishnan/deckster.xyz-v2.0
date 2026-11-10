// Build Narration motion vocabulary — single source (plan §5.3).
// All loops must be gated by useReducedMotion() at the call site.

export const COT_LINE_ENTER_S = 0.25
export const GHOST_STAGGER_S = 0.08
export const GHOST_SPRING = { type: 'spring' as const, stiffness: 260, damping: 24 }
export const SKELETON_CROSSFADE_S = 0.6
export const SHIMMER_SWEEP_S = 1.5
export const SHIMMER_REPEAT_DELAY_S = 1.5
export const BUILDING_RING_S = 1.6
export const CHECK_POP_SPRING = { type: 'spring' as const, stiffness: 400, damping: 18 }
export const PHASE_SWAP_S = 0.3
export const QA_SHEEN_S = 2.4
export const OVERLAY_DISSOLVE_S = 0.4
export const DECK_SETTLE_S = 0.5
// Canvas v2: one full orbit of the slide-frame comet.
export const PERIMETER_ORBIT_S = 3.2
export const PRESENCE_SHUFFLE_S = 1.8
