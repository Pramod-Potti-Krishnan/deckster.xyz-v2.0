/**
 * Friendly labels for the `per_stage[].stage` tags carried on the `token_usage`
 * WebSocket frame (see the `StageTokenTotal` type in
 * hooks/use-deckster-websocket-v2.ts).
 *
 * Today the token strip (components/builder/token-usage-strip.tsx) only renders
 * session/turn totals — there is no per-stage ledger UI yet. This module is the
 * single source of truth for stage → label mapping for when that panel is built:
 * pass a raw `stage` tag, get back a human label.
 *
 * Slide Builder contributes one entry per built slide on extended-generation /
 * atomic sessions, tagged `slide_builder_slide_0`, `slide_builder_slide_1`, …
 * (0-based). These are prefix-matched so the label survives any slide count.
 * Note: Slide Builder cost is already folded into the `turn`/`session` totals by
 * Director, so the headline credit balance is correct with no extra work — this
 * mapping is only for the per-stage breakdown.
 */

// Director-internal stages — taxonomy mirrors docs/api/TOKEN_USAGE_CONTRACT.md
// in the Director repo. Unknown tags fall through to prettifyUnknownStage().
const DIRECTOR_STAGE_LABELS: Record<string, string> = {
  stage_1_strategic_analysis: "Strategic Analysis",
  stage_1_5_slide_intent: "Intent Assessment",
  stage_2_framework_selection: "Framework Selection",
  stage_3_pre_planning_brief: "Pre-Planning Brief",
  stage_3_dual_track_matching: "Dual-Track Matching",
  stage_4_monolithic_painter: "Painter (Monolithic)",
  stage_4a_outline: "Painter — Outline",
  stage_4a_single_batch_narrative: "Painter — Narrative (Single Batch)",
  stage_4a_per_batch_narrative: "Painter — Narrative (Multi Batch)",
  stage_4a1_outline: "Painter — Outline (4a1)",
  stage_4b_structure_conversion: "Structure Conversion",
  stage_4c_hero_per_slide: "Painter — Hero Per Slide",
  stage_4c_detailed_per_slide: "Painter — Detail Per Slide",
}

const SLIDE_BUILDER_PREFIX = "slide_builder_slide_"

/** Friendly bucket label for any Slide Builder per-slide stage (rollup view). */
export const SLIDE_BUILDER_LABEL = "Slide Builder"

/**
 * Map a `token_usage` per_stage tag to a friendly display label.
 *
 * - `slide_builder_slide_{N}` (0-based) → "Slide Builder · Slide {N+1}"
 * - known Director stages → their taxonomy label
 * - anything else → a prettified version of the raw tag (graceful fallback)
 */
export function getTokenStageLabel(stage: string): string {
  if (stage.startsWith(SLIDE_BUILDER_PREFIX)) {
    const index = Number.parseInt(stage.slice(SLIDE_BUILDER_PREFIX.length), 10)
    return Number.isFinite(index)
      ? `${SLIDE_BUILDER_LABEL} · Slide ${index + 1}`
      : SLIDE_BUILDER_LABEL
  }

  return DIRECTOR_STAGE_LABELS[stage] ?? prettifyUnknownStage(stage)
}

/**
 * True for any Slide Builder per-slide stage tag. Useful for rolling the
 * per-slide entries up under one "Slide Builder" bucket with a per-slide expand.
 */
export function isSlideBuilderStage(stage: string): boolean {
  return stage.startsWith(SLIDE_BUILDER_PREFIX)
}

/** "stage_9_new_thing" → "Stage 9 New Thing" */
function prettifyUnknownStage(stage: string): string {
  return stage
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
