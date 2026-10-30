// STRAWMAN CHAT (FRONTEND-1; PK's UAT feedback F-06, F-08, F-09, 30 Oct): the Director chat stops drawing what the stage already says.
//
//   F-08  The outline card in the chat no longer lists the slides (the numbered, scrolling title + type + chips list). Director's one-line "I've created an outline with N slides..." message and its
//         "Looks perfect! / Make some changes" buttons are not touched; the card keeps its heading, the deck's title and its one summary line, and the canvas note.
//   F-09  The Plan / Outline / Build / Check / Package card is gone from the chat (the chat clean job card, and the presence row's Build log: the chain of thought lives on the stage). While the stage is
//         HIDDEN the chat shows exactly ONE quiet status line, phase words and an elapsed clock: "Drafting your outline... 0:18". While the stage is open the chat shows none.
//   F-06  "Waiting for your go-ahead" is not shown in the chat when Director's build_phase said auto_proceed === true for this build (Director builds on by itself; the user has nothing to wait for).
//         Studio never presses approve for the user.
//
// One flag, NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT, the exact string "true", default off, build-time: off, nothing here runs and the chat is byte for byte what it was.
//
// "Stage open" is a parameter of every function below (the page computes it on one marked line and hands it down), so FRONTEND-2's stage-open gate (useStudioStageOpen(), PR #554) replaces that line without touching this file.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-strawman-chat.mjs transpiles this file into a bare function scope with a fake `process`. Every decision is a pure function; the components only draw what they
// return and the hook only holds the one fact Studio does not keep anywhere else (auto_proceed).

// ---------------------------------------------------------------------------
// The flag (a literal process.env read so Next inlines it at build time)
// ---------------------------------------------------------------------------

export function strawmanChatFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

export const STUDIO_STRAWMAN_CHAT_ENABLED = strawmanChatFlagOn(process.env.NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT)

// ---------------------------------------------------------------------------
// F-09: the one quiet status line
// ---------------------------------------------------------------------------

export interface StrawmanChatLineInput {
  enabled: boolean
  /** The build narration is active (a build, or the plan / outline before it, is in progress). */
  active: boolean
  phase: string
  control: string
  /** The narration's own start time (it shifts forward over a decision gate); the stage ribbon reads the same one. */
  startedAt: number | null | undefined
  now: number
  /** The stage is open (its chain of thought is on screen): the chat says nothing then. */
  stageOpen: boolean
  /** Director's build_phase said auto_proceed === true for this build. */
  autoProceed: boolean
  /** A held build is already said by something else in the chat (the slim Stopped bar of chat clean, or the amend bar of flow control). */
  heldCovered: boolean
}

export interface StrawmanChatLine {
  /** "Drafting your outline..." (a running phase ends in an ellipsis), "Waiting for your go-ahead", "Paused". */
  words: string
  /** "0:18", only while the clock runs. */
  elapsed: string | null
  /** The clock runs: the component ticks once a second. */
  running: boolean
}

/** Phase words of a running phase. Director's outline drafting is the narration's `planning` phase (its status "Generating presentation outline"); `strawman` is the outline being shaped into slides. */
export const STRAWMAN_CHAT_RUNNING_WORDS: Readonly<Record<string, string>> = Object.freeze({
  planning: 'Drafting your outline…',
  strawman: 'Shaping your outline…',
  building: 'Building your slides…',
  qa: 'Checking your slides…',
  finalizing: 'Packaging your deck…',
})

export const STRAWMAN_CHAT_WAITING_WORDS = 'Waiting for your go-ahead'
export const STRAWMAN_CHAT_CONTROL_WORDS: Readonly<Record<string, string>> = Object.freeze({
  stop_requested: 'Stopping…',
  pause_requested: 'Pausing…',
  resume_requested: 'Resuming…',
})

/** "m:ss" from the narration's start (the same arithmetic as the stage ribbon's clock). Null when there is no usable start. */
export function strawmanChatElapsed(startedAt: number | null | undefined, now: number): string | null {
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt) || typeof now !== 'number' || !Number.isFinite(now)) return null
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * The chat's ONE status line while a build is narrated, or null when the chat says nothing: the flag is off, nothing is narrated, the stage is open, the build is over or failed (the stage and Director's own
 * messages say that), the build waits for the user but Director builds on by itself (F-06), or a held build is already said by a bar (heldCovered).
 */
export function strawmanChatLine(input: StrawmanChatLineInput): StrawmanChatLine | null {
  if (!input.enabled || !input.active || input.stageOpen) return null
  const control = input.control
  if (Object.prototype.hasOwnProperty.call(STRAWMAN_CHAT_CONTROL_WORDS, control)) return { words: STRAWMAN_CHAT_CONTROL_WORDS[control], elapsed: null, running: false }
  const phase = input.phase
  const held = control === 'stopped' || control === 'paused' || phase === 'stopped' || phase === 'paused'
  if (held) {
    if (input.heldCovered) return null
    return { words: control === 'stopped' || (control !== 'paused' && phase === 'stopped') ? 'Stopped' : 'Paused', elapsed: null, running: false }
  }
  if (phase === 'awaiting_user') return input.autoProceed ? null : { words: STRAWMAN_CHAT_WAITING_WORDS, elapsed: null, running: false }
  if (!Object.prototype.hasOwnProperty.call(STRAWMAN_CHAT_RUNNING_WORDS, phase)) return null
  return { words: STRAWMAN_CHAT_RUNNING_WORDS[phase], elapsed: strawmanChatElapsed(input.startedAt, input.now), running: true }
}

/** The line as one string, "Drafting your outline… 0:18". */
export function strawmanChatLineText(line: StrawmanChatLine): string {
  return line.elapsed ? `${line.words} ${line.elapsed}` : line.words
}

// ---------------------------------------------------------------------------
// F-06: Director said it builds on by itself
// ---------------------------------------------------------------------------

export interface StrawmanChatAutoProceed {
  buildId: string | null
  autoProceed: boolean
}

export const STRAWMAN_CHAT_NO_AUTO_PROCEED: StrawmanChatAutoProceed = Object.freeze({ buildId: null, autoProceed: false })

/**
 * Fold one build_phase frame into what Studio remembers of auto_proceed: the newest explicit value for the newest build id. A frame of another session (ownerSessionId is not the displayed one) and a frame without a
 * build id are ignored; a frame without the field keeps what is known for the same build; a frame of a new build starts from "not auto" until it says so. Returns the same object when nothing changed.
 */
export function strawmanChatAutoProceedStep(
  state: StrawmanChatAutoProceed,
  payload: { build_id?: unknown; auto_proceed?: unknown } | null | undefined,
  ownerSessionId: string | null | undefined,
  sessionId: string | null | undefined,
): StrawmanChatAutoProceed {
  if (!payload || typeof payload !== 'object') return state
  if (typeof sessionId !== 'string' || sessionId === '' || sessionId === 'new' || ownerSessionId !== sessionId) return state
  const buildId = payload.build_id
  if (typeof buildId !== 'string' || buildId.trim() === '') return state
  const value = typeof payload.auto_proceed === 'boolean' ? payload.auto_proceed : null
  if (state.buildId === buildId) return value === null || value === state.autoProceed ? state : { buildId, autoProceed: value }
  return { buildId, autoProceed: value === true }
}

/** Director said auto_proceed === true for the build the narration is on. No build id on the narration (the heuristic path): not known, so not auto. */
export function strawmanChatAutoProceedFor(state: StrawmanChatAutoProceed, narrationBuildId: string | null | undefined): boolean {
  return state.autoProceed === true && typeof narrationBuildId === 'string' && narrationBuildId !== '' && state.buildId === narrationBuildId
}

// ---------------------------------------------------------------------------
// F-08: the outline card without the slide list
// ---------------------------------------------------------------------------

export interface StrawmanChatOutlineInput {
  mainTitle: string
  slideCount: number
  durationMinutes: number | string | null | undefined
  overallTheme: string | null | undefined
  audience: string | null | undefined
  historyStatus?: 'earlier' | 'current'
  onCanvas?: boolean
  canvasSuperseded?: boolean
  outlineLabel?: boolean
  deckSlideCount?: number | null
}

export interface StrawmanChatOutlineModel {
  /** data-studio-director-part of the section. */
  part: 'outline-review' | 'outline-history-review'
  ariaLabel: string
  heading: string
  title: string
  /** "Outline · 7 slides · 20 min · Corporate". */
  meta: string
  /** "The deck now has 9 slides.", only while the outline label is on and the counts differ. */
  deckCount: string | null
  /** "This outline has different notes. ...", for the current outline of a history pair. */
  currentNote: string | null
  /** "For <audience>", only where the slide list used to be inline. */
  audience: string | null
  canvasNote: string | null
  supersededNote: string | null
  /** The wrapper for an earlier outline: its summary line, else null. */
  historySummary: string | null
}

/** What the outline card keeps once the slide list is gone; every word is the card's own (components/builder/chat/studio-outline-card.tsx). */
export function strawmanChatOutlineModel(input: StrawmanChatOutlineInput): StrawmanChatOutlineModel {
  const earlier = input.historyStatus === 'earlier' || input.canvasSuperseded === true
  const count = input.slideCount
  const audience = typeof input.audience === 'string' && input.audience !== '' ? input.audience : null
  const theme = input.overallTheme ? ` · ${input.overallTheme}` : ''
  const showDeckCount = input.outlineLabel === true && typeof input.deckSlideCount === 'number' && Number.isFinite(input.deckSlideCount) && input.deckSlideCount !== count
  return {
    part: input.historyStatus === 'earlier' ? 'outline-history-review' : 'outline-review',
    ariaLabel: earlier ? 'Earlier presentation outline' : 'Presentation outline',
    heading: earlier ? 'Earlier outline' : input.historyStatus === 'current' ? 'Current outline' : 'Presentation outline',
    title: input.mainTitle,
    meta: `${input.outlineLabel ? 'Outline · ' : ''}${count} slides · ${input.durationMinutes} min${theme}`,
    deckCount: showDeckCount ? `The deck now has ${input.deckSlideCount} slides.` : null,
    currentNote: input.historyStatus === 'current' ? 'This outline has different notes. The earlier outline remains available above.' : null,
    audience: input.onCanvas || input.canvasSuperseded ? null : audience,
    canvasNote: input.onCanvas ? 'The outline is on the canvas. Review each slide there, then approve it or ask for changes.' : null,
    supersededNote: !input.onCanvas && input.canvasSuperseded ? 'Replaced by the outline on the canvas.' : null,
    historySummary: input.historyStatus === 'earlier' ? `Earlier outline · ${count} slides` : null,
  }
}
