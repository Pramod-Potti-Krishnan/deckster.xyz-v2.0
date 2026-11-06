/**
 * RAIL-SLIDES-1-MIDBUILD (flag NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT, exact 'true', default off): during a build the thumbnail
 * rail kept "Slides 1" from the first built slide until the build finished.
 *
 * Why: at the first slide_built the stage swaps from the strawman deck (every slide a row) to the FILLING final deck
 * (app/builder/page.tsx narrationCenterStage 'final_fill'). That swap nulls the page's slide structure and count, and the
 * viewer resets its counters and then takes its count only from the iframe's own answer (getCurrentSlideInfo -> Reveal
 * getTotalSlides, layout-builder-v7.5 src/core/reveal-config.js getCurrentSlideInfo, served by viewer/presentation-viewer.html
 * case 'getCurrentSlideInfo'). The Layout viewer reads the deck once, when the frame loads, so the answer is "the slides
 * persisted at that moment" (1) and stays 1 until the completion reload. Slides 2..N are built but not in the frame. With the
 * Layout slide inventory on, the rows come from the inventory, which is re-read only on a count change or a preview frame, so
 * a deck whose first preview is ready stops re-reading and the rows stay at 1 as well.
 *
 * With the flag on, while the build is running the rail never counts below the plan's slide_count: the slides the rail has
 * are real rows, the rest are inert placeholders (a built slide's preview shows as soon as its Stage F frame arrives), and
 * the heading reads the plan count. A row whose slide is built (slide_built) reads "Built" instead of "Preview loading".
 * The floor lasts only while the viewer shows this build's filling deck in a building / qa / finalizing / paused phase;
 * complete, stopped and error hand the rail back to the deck's real count.
 * Pure helpers, no imports. Flag off: callers pass nothing and the strip renders exactly as before.
 */
export const STUDIO_RAIL_BUILD_COUNT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT === 'true'

const FLOOR_PHASES = ['building', 'qa', 'finalizing', 'paused']

export interface RailBuildPlan {
  /** The plan's slide_count (typed build_phase / slide_built frames). */
  slideCount: number
  /** Strawman titles by 0-based slide index; null where the plan gave none. */
  titles: Array<string | null>
  /** By 0-based slide index: the build has reported this slide built (slide_built). */
  built: boolean[]
}

export interface RailBuildPlaceholder {
  slideNumber: number
  title: string | null
  /** The build has reported this slide built, though the frame on stage does not hold it yet. */
  built: boolean
  /** A built slide's Stage F preview, when its frame has arrived. */
  thumbnailUrl: string | null
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * The plan the rail must not count below, or null when the floor does not apply (flag off, not the Studio shell, the
 * viewer is not showing this build's filling deck, or the build is not in a running phase).
 */
export function railBuildPlanFor(input: {
  enabled: boolean
  studioShell: boolean
  /** The viewer shows the filling artifact of a build (page `final_fill`), not the strawman deck or a settled deck. */
  partialArtifact: boolean
  narrationActive: boolean
  phase: string
  slideCount: number
  buildPresentationId: string | null | undefined
  presentationId: string | null | undefined
  ghosts: ReadonlyArray<{ index: number; title: string }> | null | undefined
  /** NarrationState.slideStates: 0-based slide index -> pending / building / qa / built / ... */
  slideStates: Record<number, string> | null | undefined
}): RailBuildPlan | null {
  if (!input.enabled || !input.studioShell || !input.partialArtifact || !input.narrationActive) return null
  if (!FLOOR_PHASES.includes(input.phase)) return null
  const slideCount = whole(input.slideCount)
  if (slideCount < 1) return null
  if (!input.buildPresentationId || input.buildPresentationId !== input.presentationId) return null
  const titles: Array<string | null> = Array.from({ length: slideCount }, () => null)
  for (const ghost of input.ghosts ?? []) {
    const index = Number.isInteger(ghost?.index) ? ghost.index : -1
    const title = typeof ghost?.title === 'string' ? ghost.title.trim() : ''
    if (index >= 0 && index < slideCount && title) titles[index] = title
  }
  const built = Array.from({ length: slideCount }, (_, index) => input.slideStates?.[index] === 'built')
  return { slideCount, titles, built }
}

/** The rail heading: the larger of the real total, the rows on screen and the plan. Without a plan, the real total as before. */
export function railBuildHeadingTotal(input: {
  totalSlides: number
  rows: number
  plan: RailBuildPlan | null
}): number {
  if (!input.plan) return input.totalSlides
  return Math.max(whole(input.totalSlides), whole(input.rows), input.plan.slideCount)
}

/** The inert rows after the real ones: slide numbers rows+1 .. plan, each with its strawman title and, once built, its preview. */
export function railBuildPlaceholders(input: {
  rows: number
  plan: RailBuildPlan | null
  thumbnailUrlsBySlide: Record<number, string> | null | undefined
}): RailBuildPlaceholder[] {
  const { plan } = input
  if (!plan) return []
  const rows = whole(input.rows)
  const out: RailBuildPlaceholder[] = []
  for (let index = rows; index < plan.slideCount; index += 1) {
    const url = input.thumbnailUrlsBySlide?.[index]
    out.push({
      slideNumber: index + 1,
      title: plan.titles[index] ?? null,
      built: plan.built[index] === true,
      thumbnailUrl: typeof url === 'string' && url.trim() ? url.trim() : null,
    })
  }
  return out
}
