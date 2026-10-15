// PASS2-DIRECTOR-CHAT PR D, item 6 (flag NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT): the one line of words above the composer that says
// what a message will be about, as the accepted v4 mockup's composer does ("Working on slide 3").
//
// Pure and import-free: it is handed values the Builder page already holds (whether a deck is open, the slide on the canvas) and returns
// a string. It reads nothing, stores nothing and sends nothing. The flag is checked by the caller.

// PASS2B G12 (flag NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT, exact 'true', default off; read by the page, which supplies `stage` only when on):
// before a built deck exists the line names the stage, as the accepted v4 mockup's composer does ("Review the outline", "Bring it to life"),
// instead of "New presentation" (planning) or "Working on slide 1" (an outline or a build in progress has slides on the canvas, but none is
// being worked on). The stage comes from state the page already holds: the canvas lifecycle (is a built deck there), the deck's version
// (outline = "strawman"), the build narration phase and whether Director is working. Once a built deck exists the line is as before.
export type StudioComposerStage = 'planning' | 'outline' | 'building'

export const STUDIO_COMPOSER_STAGE_LABELS: Record<StudioComposerStage, string> = {
  planning: 'Planning your deck',
  outline: 'Reviewing the outline',
  building: 'Building slides',
}

export interface StudioComposerStageInput {
  /** A built deck is on the canvas (the canvas lifecycle's "generated" deck: final version, owned, with slides). */
  builtDeck: boolean
  /** The deck's version on the canvas: "blank", "strawman" (the outline) or "final". */
  activeVersion?: string | null
  /** Director is turning the approved outline into slides. */
  generatingFinal: boolean
  /** The build narration phase ("idle" when narration is not active). */
  phase: string
  /** Director is working on, or waiting for an answer to, the brief (what the canvas shows as "Waiting for Director"). */
  directorWorking: boolean
}

export interface StudioComposerContext {
  /** A presentation with slides is open (the same test the transcript uses for its "open deck" context). */
  deckOpen: boolean
  /** The slide on the canvas, 1-based. */
  slideNumber: number
  /** How many slides the open deck has, when known. */
  slideCount?: number | null
  /** G12: supplied only with NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT on. Absent = the line is exactly as before. */
  stage?: StudioComposerStageInput
}

const STUDIO_COMPOSER_BUILD_PHASES = ['building', 'qa', 'finalizing']

/** The stage the composer line names, or null when the line is "New presentation" / "Working on slide N" as before. */
export function studioComposerStage(input: StudioComposerStageInput & { deckOpen: boolean }): StudioComposerStage | null {
  if (input.generatingFinal || STUDIO_COMPOSER_BUILD_PHASES.includes(input.phase)) return 'building'
  if (input.builtDeck) return null
  if (input.deckOpen) return input.activeVersion === 'strawman' ? 'outline' : null
  return input.directorWorking ? 'planning' : null
}

export function studioComposerContextLabel(context: StudioComposerContext): string {
  if (context.stage) {
    const stage = studioComposerStage({ ...context.stage, deckOpen: context.deckOpen })
    if (stage) return STUDIO_COMPOSER_STAGE_LABELS[stage]
  }
  if (!context.deckOpen) return 'New presentation'
  const { slideNumber, slideCount } = context
  const countKnown = typeof slideCount === 'number' && Number.isFinite(slideCount) && slideCount > 0
  if (Number.isInteger(slideNumber) && slideNumber >= 1 && (!countKnown || slideNumber <= (slideCount as number))) {
    return `Working on slide ${slideNumber}`
  }
  return 'Working on your presentation'
}
