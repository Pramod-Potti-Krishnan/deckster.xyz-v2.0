// FRONTEND-1 (PK's UAT feedback F-04, F-05, F-07; 30 Oct): flag NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE (the string "true", default off, build-time).
// Today, while Director's outline approval is live, the canvas shows a separate outline design (components/builder/studio-outline-canvas.tsx) over the deck viewer, and after the approval the stage jumps to the deck.
// On, there is no separate outline design and no jump: from the outline on, the stage is the normal deck viewer showing Director's Layout strawman preview deck (its slide_update preview_url, which Studio already loads as the
// presentation URL), each slide's plan sits under it, and when the built deck replaces the preview deck the viewer stays on the slide the user was on.
//   (a) The plan: title + content type + key points of the slide on stage, from what is already on the wire: slide_update payload.slides[i] (title, key_points, service) and slide_context [i] (content_type, subtype, key_message).
//       A field that is empty is not drawn; nothing is made up (a content type is the wire's own word with its underscores read as spaces).
//   (b) The phase: "strawman" while the stage shows the preview deck and no build is on it, "built" once the build's deck is there, null when this does not apply (flag off, template mode, a blank canvas).
//   (c) The kept slide: the slide the user was on while the strawman showed, and the one step that takes the viewer back to it once the built deck's viewer is ready (the hook is hooks/use-studio-strawman-stage.ts).
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
// (b) The phase
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
// (a) The plan
// ---------------------------------------------------------------------------

/** At most this many lines under a slide (the key message first). */
export const STRAWMAN_STAGE_MAX_POINTS = 6

export interface StrawmanStagePlan {
  /** 1-based position and the number of slides, when the outline frame is there. */
  position: number | null
  total: number | null
  title: string | null
  /** Content type (+ subtype), else the service. */
  chip: string | null
  /** The key message first, then the key points, without repeats. */
  points: string[]
}

type Loose = Record<string, unknown>
const isRecord = (value: unknown): value is Loose => typeof value === 'object' && value !== null

/** A non-empty string with its white space collapsed, else null. */
function plainText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed || null
}

/** The wire's own word, its underscores read as spaces and its first letter capital ("text_heavy" -> "Text heavy"). */
function readable(value: unknown): string | null {
  const text = plainText(value)
  if (!text) return null
  const spaced = text.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : null
}

/** The chip: content_type (+ subtype when it says more), else the service; null when the wire names neither. */
export function strawmanStageChip(context: unknown, slide: unknown): string | null {
  const type = readable(isRecord(context) ? context.content_type : null)
  if (type) {
    const subtype = readable(isRecord(context) ? context.subtype : null)
    return subtype && subtype.toLowerCase() !== type.toLowerCase() ? `${type} · ${subtype}` : type
  }
  return readable(isRecord(slide) ? slide.service : null)
}

/** The plan of the slide at `index` (0-based), or null when there is nothing to show for it. `slides` is slide_update payload.slides, `contextByIndex` the page's slide_context map. */
export function strawmanStagePlan(input: { slides: unknown; contextByIndex: unknown; index: number }): StrawmanStagePlan | null {
  const slides = Array.isArray(input.slides) ? input.slides : []
  const wanted = Number.isInteger(input.index) && input.index >= 0 ? input.index : 0
  const index = slides.length ? Math.min(wanted, slides.length - 1) : wanted
  const slide = slides.length ? slides[index] : null
  const context = isRecord(input.contextByIndex) ? input.contextByIndex[index] : null
  const title = plainText(isRecord(slide) ? slide.title : null)
  const chip = strawmanStageChip(context, slide)
  const seen = new Set<string>(title ? [title.toLowerCase()] : [])
  const points: string[] = []
  const add = (value: unknown) => {
    const text = plainText(value)
    if (!text || seen.has(text.toLowerCase())) return
    seen.add(text.toLowerCase())
    points.push(text)
  }
  add(isRecord(context) ? context.key_message : null)
  const keyPoints = isRecord(slide) && Array.isArray(slide.key_points) ? slide.key_points : []
  for (const point of keyPoints) add(point)
  if (!title && !chip && !points.length) return null
  return {
    position: slides.length ? index + 1 : null,
    total: slides.length || null,
    title,
    chip,
    points: points.slice(0, STRAWMAN_STAGE_MAX_POINTS),
  }
}

// ---------------------------------------------------------------------------
// (c) The kept slide
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

/** The next step of a pending return: wait for the viewer of the built deck, go to the slide (no further than the deck's last slide), or give up. */
export function strawmanStageKeepStep(input: {
  pending: StrawmanStagePending | null
  now: number
  hasViewerApi: boolean
  viewerReady: boolean
  /** Slides the built deck holds, when known. */
  slideCount: number | null | undefined
}): StrawmanStageKeep {
  const { pending } = input
  if (!pending || input.now - pending.at > STRAWMAN_STAGE_KEEP_MAX_MS) return { action: 'drop' }
  if (!input.hasViewerApi || !input.viewerReady) return { action: 'wait', retryInMs: STRAWMAN_STAGE_KEEP_RETRY_MS }
  const count = typeof input.slideCount === 'number' && Number.isInteger(input.slideCount) && input.slideCount > 0 ? input.slideCount : null
  const index = count === null ? pending.index : Math.min(pending.index, count - 1)
  // A deck that opens on slide 1 and has no further slide yet has nowhere to go.
  return index > 0 ? { action: 'go', index } : { action: 'drop' }
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
