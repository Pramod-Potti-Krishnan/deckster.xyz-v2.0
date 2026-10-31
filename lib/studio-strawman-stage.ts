// FRONTEND-1 (PK's UAT feedback F-04, F-07, F-06; F-11 of 31 Oct): flag NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE (the string "true", default off, build-time).
// Today, while Director's outline approval is live, the canvas shows a separate outline design (components/builder/studio-outline-canvas.tsx) over the deck viewer, and after the approval the stage jumps to the deck.
// On, there is no separate outline design and no jump: from the outline on, the stage is the normal deck viewer showing Director's Layout strawman preview deck (its slide_update preview_url, which Studio already loads as the
// presentation URL), one quiet line under it says that no action is needed, and when the built deck replaces the preview deck the viewer stays on the slide the user was on.
// What each strawman slide says about itself (title, key message, key points, content type) is the preview deck's own slide, drawn by Director's Layout preview, not by the stage (PK F-11).
//   (a) The phase: "strawman" while the stage shows the preview deck and no build is on it, "built" once the build's deck is there, null when this does not apply (flag off, template mode, a blank canvas).
//   (b) The kept slide: the slide the user was on while the strawman showed, and the one step that takes the viewer back to it once the built deck's viewer is ready (the hook is hooks/use-studio-strawman-stage.ts).
// IMPORT-FREE BY DESIGN: scripts/test-studio-strawman-stage.mjs transpiles this file into a bare function scope with a fake `process`. The page holds the state and does the I/O (goToSlide, the render); every decision is here.

// ---------------------------------------------------------------------------
// Flag (a literal process.env read so Next inlines it at build time)
// ---------------------------------------------------------------------------

export function strawmanStageFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

export const STUDIO_STRAWMAN_STAGE_ENABLED = strawmanStageFlagOn(process.env.NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE)

/** The one plain line on the stage while the strawman shows (there is no Approve on the stage: Director starts the build by itself). */
export const STRAWMAN_STAGE_NO_ACTION_LINE = 'No action needed: building starts automatically.'

// ---------------------------------------------------------------------------
// (a) The phase
// ---------------------------------------------------------------------------

export type StrawmanStagePhase = 'strawman' | 'built' | null

/** What the stage shows. `activeVersion` is the displayed version (the page's effective one: a build's filling deck counts as "final"). */
export function strawmanStagePhase(input: {
  enabled: boolean
  templateModeOn: boolean
  activeVersion: string | null | undefined
  strawmanPreviewUrl: string | null | undefined
  finalPresentationUrl: string | null | undefined
}): StrawmanStagePhase {
  if (!input.enabled || input.templateModeOn) return null
  // A strawman viewed after a build (the version switcher) is history, not the outline stage.
  if (input.activeVersion === 'strawman' && input.strawmanPreviewUrl && !input.finalPresentationUrl) return 'strawman'
  if (input.activeVersion === 'final') return 'built'
  return null
}

// ---------------------------------------------------------------------------
// (b) The kept slide
// ---------------------------------------------------------------------------

export interface StrawmanStageShown { presentationId: string | null; index: number }
/** The slide to go back to once the built deck's viewer is ready. */
export interface StrawmanStagePending { presentationId: string; index: number; at: number }
/** `held` is there only when true: the page was taken back to the kept slide, so the narration's own page turns stand down for the rest of that build (see strawmanStageHold). */
export interface StrawmanStageState { shown: StrawmanStageShown | null; pending: StrawmanStagePending | null; held?: true }

export function initialStrawmanStageState(): StrawmanStageState {
  return { shown: null, pending: null }
}

const slideIndexOf = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0)

/** Narration phases in which the build is on (it starts on its own after the outline): the stage still shows the strawman until the first built slide, and its viewer is about to be replaced. */
export const STRAWMAN_STAGE_BUILD_PHASES: readonly string[] = ['building', 'qa', 'finalizing', 'paused', 'stopped']

/** Whether the build has started: Director is generating the final deck, or the narration says a build is on. */
export function strawmanStageBuildStarted(input: { generatingFinal: boolean | null | undefined; narrationPhase: string | null | undefined }): boolean {
  return Boolean(input.generatingFinal) || (typeof input.narrationPhase === 'string' && STRAWMAN_STAGE_BUILD_PHASES.includes(input.narrationPhase))
}

/**
 * One tick of what the page shows. While the strawman shows, the deck and the slide the user is on are remembered. When the built deck (another presentation) takes the stage, a user who was past
 * slide 1 leaves a pending return to that slide for the built deck's id; slide 1 needs none (a fresh viewer opens there). Anything else (flag off, template mode, a blank canvas) forgets.
 * Once the build has started, the page's slide drops to 1 one render BEFORE the stage says the built deck is there (the built deck's viewer opens on slide 1 and reports it while the strawman is still the displayed
 * version): that report, for the very deck already remembered at a later slide, is not the user going back to slide 1, and the remembered slide stays.
 */
export function strawmanStageStep(
  state: StrawmanStageState,
  input: { phase: StrawmanStagePhase; presentationId: string | null | undefined; index: number; now: number; buildStarted?: boolean },
): StrawmanStageState {
  const id = input.presentationId || null
  if (input.phase === 'strawman') {
    const index = slideIndexOf(input.index)
    if (input.buildStarted && index === 0 && state.shown && state.shown.presentationId === id && state.shown.index > 0) return { shown: state.shown, pending: null }
    return { shown: { presentationId: id, index }, pending: null }
  }
  if (input.phase !== 'built') return initialStrawmanStageState()
  // The built deck's id is not known yet: nothing to decide.
  if (!id) return state
  // A later build is another build: the hold ends with the one it was made for.
  if (state.held && input.buildStarted === false) return { shown: state.shown, pending: state.pending }
  if (state.shown) {
    const replaced = state.shown.presentationId !== id
    return { shown: null, pending: replaced && state.shown.index > 0 ? { presentationId: id, index: state.shown.index, at: input.now } : null }
  }
  // A return waits for the deck it was left for; once another deck is on the stage it is no longer wanted.
  if (state.pending && state.pending.presentationId !== id) return { shown: null, pending: null }
  return state
}

/** How long a pending return waits for the built deck's viewer, and how often it looks. */
export const STRAWMAN_STAGE_KEEP_MAX_MS = 20000
export const STRAWMAN_STAGE_KEEP_RETRY_MS = 250

export type StrawmanStageKeep = { action: 'drop' } | { action: 'wait'; retryInMs: number } | { action: 'go'; index: number }

/**
 * The next step of a pending return: wait for the viewer of the built deck and for its slide count, go to the slide only if the deck holds it, or give up. A deck that does not hold the user's slide (yet, because
 * it grows with the build) cannot keep it: nothing is moved and nothing is held, and the narration's follow of the freshest built slide carries on as it does today.
 */
export function strawmanStageKeepStep(input: {
  pending: StrawmanStagePending | null
  now: number
  hasViewerApi: boolean
  viewerReady: boolean
  /** Slides the built deck holds, when known (the page reads it from the viewer once the deck has drawn). */
  slideCount: number | null | undefined
}): StrawmanStageKeep {
  const { pending } = input
  if (!pending || input.now - pending.at > STRAWMAN_STAGE_KEEP_MAX_MS) return { action: 'drop' }
  if (!input.hasViewerApi || !input.viewerReady) return { action: 'wait', retryInMs: STRAWMAN_STAGE_KEEP_RETRY_MS }
  const count = typeof input.slideCount === 'number' && Number.isInteger(input.slideCount) && input.slideCount > 0 ? input.slideCount : null
  // Until the count is known nothing is known of whether the deck holds the slide (going blind would hold the narration off a deck that cannot show it).
  if (count === null) return { action: 'wait', retryInMs: STRAWMAN_STAGE_KEEP_RETRY_MS }
  return pending.index < count ? { action: 'go', index: pending.index } : { action: 'drop' }
}

/** The state after the page was taken back to the kept slide: nothing pending, and the narration's own page turns stand down while this build runs. */
export function strawmanStageWent(state: StrawmanStageState): StrawmanStageState {
  return { shown: state.shown, pending: null, held: true }
}

/**
 * Whether the narration's own page turns (its follow of the freshest built slide, which pages the viewer back to slide 1 each time the viewer reports in) stand down: only after the page was taken
 * back to the user's slide, while the built deck is on the stage and its build is running. A deck too short for the user's slide is not gone back to, and then the follow carries on as it does today.
 */
export function strawmanStageHold(input: { held: boolean; phase: StrawmanStagePhase; buildStarted: boolean }): boolean {
  return input.held && input.phase === 'built' && input.buildStarted
}
