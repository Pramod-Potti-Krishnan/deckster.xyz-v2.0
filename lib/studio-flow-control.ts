// P3-1 D "flow control" (Studio half): three flags, all default off, build-time.
//   NEXT_PUBLIC_STUDIO_FLOW_FOCUS  - the stage follows the slide Director just built or changed.
//   NEXT_PUBLIC_STUDIO_FLOW_AMEND  - while a build is paused (or stopped) the user can type changes, then Resume or
//                                    Rebuild with them. Needs NEXT_PUBLIC_BUILD_NARRATION and NEXT_PUBLIC_BUILD_CONTROL.
//   NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS - Resume also carries the typed text to Director (build_control
//                                    `instructions`, 1000 characters at most). Needs the amend flag. Off until
//                                    Director ships the field (DIRECTOR_FLOW_STEER_ENABLED).
// The Director side of this is streams/director2/flow-control/CONTRACT.md (26 Oct): a message sent while paused is
// acked with build_phase {phase:"paused", steer_pending:true}; a resume with instructions is acked with build_phase
// {phase:"building", applied_to:[slide indexes]}; after a stop a second build_phase {phase:"settled"} says the build
// turn really returned.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-flow-control.mjs transpiles this file into a bare function scope with a
// fake `process`. Every decision the page makes about the two flows lives here as a pure function; the page only
// holds the state and does the I/O (goToSlide, select the stage pane, send build_control, send the draft).

// ---------------------------------------------------------------------------
// Flags (literal process.env reads so Next inlines them at build time)
// ---------------------------------------------------------------------------

export function flowFocusFlagOn(focus: string | undefined): boolean {
  return focus === 'true'
}

/** Amend needs the narration canvas (where the pause/stop controls live) and the build control flag. */
export function flowAmendFlagOn(
  amend: string | undefined,
  narration: string | undefined,
  control: string | undefined,
): boolean {
  return amend === 'true' && narration === 'true' && control === 'true'
}

/** The `instructions` field on resume is a sub-behaviour of amend: it can never be on without it. */
export function flowAmendInstructionsFlagOn(
  instructions: string | undefined,
  amend: string | undefined,
  narration: string | undefined,
  control: string | undefined,
): boolean {
  return instructions === 'true' && flowAmendFlagOn(amend, narration, control)
}

export const STUDIO_FLOW_FOCUS_ENABLED = flowFocusFlagOn(process.env.NEXT_PUBLIC_STUDIO_FLOW_FOCUS)
export const STUDIO_FLOW_AMEND_ENABLED = flowAmendFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_FLOW_AMEND,
  process.env.NEXT_PUBLIC_BUILD_NARRATION,
  process.env.NEXT_PUBLIC_BUILD_CONTROL,
)
export const STUDIO_FLOW_AMEND_INSTRUCTIONS_ENABLED = flowAmendInstructionsFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS,
  process.env.NEXT_PUBLIC_STUDIO_FLOW_AMEND,
  process.env.NEXT_PUBLIC_BUILD_NARRATION,
  process.env.NEXT_PUBLIC_BUILD_CONTROL,
)

// ---------------------------------------------------------------------------
// The bus between the socket hook and the page's flow hook
// ---------------------------------------------------------------------------
// The socket hook is called before the page has what the flow hook needs, and the page's older pins read it by position: so the two meet here, not in
// the socket hook's options. useStudioFlowControl fills `focus` and `phase` (only with their flags on) and clears them when the page goes; the socket
// hook shows them frames. `instructions` is set by the flow hook and taken, once, by the very sendBuildControl call it makes next.
export const flowBus: {
  focus: ((frame: unknown) => void) | null
  phase: ((payload: unknown) => void) | null
  instructions: string | undefined
} = { focus: null, phase: null, instructions: undefined }

/** What the flow hook left for the build_control request being made right now, taken so that no other request ever carries it. */
export function takeFlowInstructions(): string | undefined {
  const text = flowBus.instructions
  flowBus.instructions = undefined
  return text
}

// ---------------------------------------------------------------------------
// Flow focus
// ---------------------------------------------------------------------------

/** A manual navigation holds the stage still for this long (an event inside the window is ignored). */
export const FLOW_FOCUS_USER_NAV_GRACE_MS = 4000
/** Wait this long after an event before navigating: a refresh of the viewer may be starting. */
export const FLOW_FOCUS_SETTLE_MS = 400
/** Give up on a navigation that never found the viewer ready. */
export const FLOW_FOCUS_MAX_WAIT_MS = 6000
/** A slide change the viewer reports within this long of our own goToSlide, to that slide, is ours. */
export const FLOW_FOCUS_SELF_NAV_MS = 2000
/** Slide changes the viewer reports this long after an event are the viewer reloading, not the user. */
export const FLOW_FOCUS_EVENT_SETTLE_MS = 2500

export type FlowFocusKind = 'deck_mutation' | 'slide_built' | 'slide_ready' | 'slide_update' | 'change_recorded'

export interface FlowFocusEvent {
  kind: FlowFocusKind
  presentationId: string | null | undefined
  /** 0-based slide index of the event. */
  slideIndex: number | null | undefined
  /** deck_mutation new_slide_index; wins over slideIndex when present. */
  newSlideIndex?: number | null
  /** deck_mutation mutation kind; a deleted slide has nothing to show. */
  mutation?: string | null
  /** deck_mutation after an undo restored a version (deck_restored): its slide index is always 0 and means nothing. */
  restored?: boolean
  /** The build a slide_built belongs to (the narration build id). */
  buildKey?: string | null
  /** The frame's message_id: a frame delivered twice is acted on once. */
  messageId?: string | null
}

export interface FlowFocusState {
  lastUserNavAt: number | null
  /** The build whose slide_built events stopped being followed because the user took over. */
  takenOverBuildKey: string | null
  selfIndex: number | null
  selfUntil: number
  settleUntil: number
  lastSeenIndex: number | null
  buildKey: string | null
  newestBuiltIndex: number | null
}

export interface FlowFocusTarget {
  /** null = only bring the stage up (a restored deck has no slide of its own to show). */
  index: number | null
  /** On an overlay layout the stage pane is not the one showing: select it first. */
  selectStage: boolean
}

export function initialFlowFocusState(): FlowFocusState {
  return {
    lastUserNavAt: null,
    takenOverBuildKey: null,
    selfIndex: null,
    selfUntil: 0,
    settleUntil: 0,
    lastSeenIndex: null,
    buildKey: null,
    newestBuiltIndex: null,
  }
}

function isSlideIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function cleanId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value === value.trim() ? value : null
}

type FrameLike = { type?: unknown; payload?: unknown; message_id?: unknown } | null | undefined

/** The frames the stage follows (flowFocusEventFromFrame turns them into events); the socket hook shows these, and no others, to the page. */
export const FLOW_FOCUS_FRAME_TYPES: readonly string[] = ['deck_mutation', 'change_recorded', 'slide_built', 'slide_ready', 'slide_update']
export function isFlowFocusFrameType(type: unknown): boolean {
  return typeof type === 'string' && FLOW_FOCUS_FRAME_TYPES.includes(type)
}

function bodyOf(frame: FrameLike): Record<string, unknown> | null {
  const body = frame && typeof frame === 'object' ? (frame as { payload?: unknown }).payload : null
  return body && typeof body === 'object' ? body as Record<string, unknown> : null
}

/**
 * The focus event a Director frame stands for, or null. Index conventions differ per frame (CONTRACT.md):
 * deck_mutation / slide_built / slide_ready / change_recorded are 0-based; slide_update's slides[].slide_number is
 * 1-based and is converted here. build_event, slide_progress and bulk_edit_progress carry an index but no
 * presentation_id, so they are never a focus event.
 */
export function flowFocusEventFromFrame(input: unknown): FlowFocusEvent | null {
  const frame = input as FrameLike
  const body = bodyOf(frame)
  if (!body) return null
  const messageId = cleanId(frame?.message_id)
  switch (frame?.type) {
    case 'deck_mutation':
      return {
        kind: 'deck_mutation',
        messageId,
        presentationId: cleanId(body.presentation_id),
        slideIndex: isSlideIndex(body.slide_index) ? body.slide_index : null,
        newSlideIndex: body.new_slide_index == null ? null : isSlideIndex(body.new_slide_index) ? body.new_slide_index : Number.NaN,
        mutation: typeof body.mutation === 'string' ? body.mutation : null,
        restored: body.restored === true || body.mutation === 'deck_restored',
      }
    case 'slide_built':
    case 'slide_ready':
      return {
        kind: frame.type,
        messageId,
        presentationId: cleanId(body.presentation_id),
        slideIndex: isSlideIndex(body.slide_index) ? body.slide_index : null,
      }
    case 'change_recorded': {
      // slide_index is not sent yet; use it when it is, and only then (a change with no single slide has nothing to show).
      if (!isSlideIndex(body.slide_index)) return null
      return { kind: 'change_recorded', messageId, presentationId: cleanId(body.presentation_id), slideIndex: body.slide_index }
    }
    case 'slide_update': {
      if (body.operation !== 'partial_update') return null // a full update is the whole outline arriving, not one slide changing
      const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : null
      const slides = Array.isArray(body.slides) ? body.slides as Array<Record<string, unknown> | null> : []
      const affected = Array.isArray(body.affected_slides)
        ? new Set((body.affected_slides as unknown[]).filter((id): id is string => typeof id === 'string')) : null
      const changed = affected && affected.size > 0
        ? slides.filter(slide => slide && typeof slide.slide_id === 'string' && affected.has(slide.slide_id)) : slides
      const last = changed.length ? changed[changed.length - 1] : null
      const number = last?.slide_number
      return {
        kind: 'slide_update',
        messageId,
        presentationId: cleanId(metadata?.preview_presentation_id) ?? cleanId(body.preview_presentation_id),
        slideIndex: typeof number === 'number' && Number.isSafeInteger(number) && number >= 1 ? number - 1 : null, // 1-based on the wire
      }
    }
    default:
      return null
  }
}

/** The slide an event points at: new_slide_index ?? slide_index. A bad index (or a deleted slide) points nowhere. */
export function flowFocusIndex(event: Pick<FlowFocusEvent, 'kind' | 'slideIndex' | 'newSlideIndex' | 'mutation'>): number | null {
  if (event.kind === 'deck_mutation' && event.mutation === 'slide_deleted') return null
  const raw = event.newSlideIndex ?? event.slideIndex
  return isSlideIndex(raw) ? raw : null
}

/**
 * Where the stage should go for this event, or null to leave it alone.
 * Ignored: flag off, another presentation (or none on stage), a bad index, a user who navigated by hand in the last
 * graceMs, and, for slide_built, a build the user already took over or a slide that is not newer than the last one
 * followed in that build. A restored deck has no index to go to: on an overlay layout it only brings the stage up.
 */
export function flowFocusTarget(input: {
  enabled: boolean
  event: FlowFocusEvent
  displayedPresentationId: string | null | undefined
  /** Other decks that count as "ours": the deck this very build is filling, before the stage has swapped to it. */
  alsoPresentationIds?: ReadonlyArray<string | null | undefined>
  overlay: boolean
  state: FlowFocusState
  now: number
  graceMs?: number
}): FlowFocusTarget | null {
  if (!input.enabled) return null
  const { event, state } = input
  const presentationId = event.presentationId
  if (typeof presentationId !== 'string' || !presentationId) return null
  const ours = presentationId === input.displayedPresentationId || (input.alsoPresentationIds ?? []).includes(presentationId)
  if (!ours) return null
  const grace = input.graceMs ?? FLOW_FOCUS_USER_NAV_GRACE_MS
  if (state.lastUserNavAt !== null && input.now - state.lastUserNavAt < grace) return null
  if (event.kind === 'deck_mutation' && event.restored) return input.overlay ? { index: null, selectStage: true } : null
  const index = flowFocusIndex(event)
  if (index === null) return null
  if (event.kind === 'slide_built') {
    const buildKey = event.buildKey ?? null
    if (buildKey !== null && state.takenOverBuildKey === buildKey) return null
    if (buildKey !== null && state.buildKey === buildKey && state.newestBuiltIndex !== null && index <= state.newestBuiltIndex) return null
  }
  return { index, selectStage: input.overlay }
}

/** The state after an event was acted on: the viewer is about to reload, and the newest built slide moves on. */
export function flowFocusAfterTarget(state: FlowFocusState, event: FlowFocusEvent, index: number | null, now: number): FlowFocusState {
  const next: FlowFocusState = { ...state, settleUntil: now + FLOW_FOCUS_EVENT_SETTLE_MS }
  if (event.kind === 'slide_built' && index !== null) {
    const buildKey = event.buildKey ?? null
    if (buildKey !== next.buildKey) {
      next.buildKey = buildKey
      next.newestBuiltIndex = index
    } else {
      next.newestBuiltIndex = next.newestBuiltIndex === null ? index : Math.max(next.newestBuiltIndex, index)
    }
  }
  return next
}

/** We are about to call goToSlide(index): the viewer's report of it is ours, not the user's. */
export function flowFocusMarkSelf(state: FlowFocusState, index: number, now: number): FlowFocusState {
  return { ...state, selfIndex: index, selfUntil: now + FLOW_FOCUS_SELF_NAV_MS }
}

/** The user did something that is plainly navigation (a pane switch, a rail click): it always counts. */
export function flowFocusNoteUserNav(state: FlowFocusState, now: number, buildKey?: string | null): FlowFocusState {
  return { ...state, lastUserNavAt: now, takenOverBuildKey: buildKey ?? state.buildKey ?? state.takenOverBuildKey }
}

/**
 * The viewer reports the slide it is on. Ours (a goToSlide we made), the viewer's own reload just after an event, and
 * a slide that did not change are not the user; anything else is.
 */
export function flowFocusNoteSlideChange(state: FlowFocusState, index: number, now: number, buildKey?: string | null): FlowFocusState {
  if (state.lastSeenIndex === null) return { ...state, lastSeenIndex: index } // the first report is where the viewer starts, not a move
  if (state.selfIndex === index && now < state.selfUntil) return { ...state, lastSeenIndex: index }
  if (now < state.settleUntil) return { ...state, lastSeenIndex: index }
  if (state.lastSeenIndex === index) return state
  return { ...flowFocusNoteUserNav(state, now, buildKey), lastSeenIndex: index }
}

export interface FlowFocusPending {
  index: number
  /** The deck the slide is in: the viewer must be showing it before we navigate. */
  presentationId: string
  /** When the event arrived. */
  at: number
}

export type FlowFocusStep =
  | { action: 'go' }
  | { action: 'wait'; retryInMs: number }
  | { action: 'drop' }

/**
 * Time to navigate? Not before the settle delay; not at all after maxWaitMs or if the user navigated since the event;
 * and not until the viewer can take a command (viewerReady is true where the page cannot tell).
 */
export function flowFocusStep(input: {
  pending: FlowFocusPending
  now: number
  state: FlowFocusState
  hasViewerApi: boolean
  viewerReady: boolean
  settleMs?: number
  maxWaitMs?: number
}): FlowFocusStep {
  const settleMs = input.settleMs ?? FLOW_FOCUS_SETTLE_MS
  const maxWaitMs = input.maxWaitMs ?? FLOW_FOCUS_MAX_WAIT_MS
  const { pending, state } = input
  if (state.lastUserNavAt !== null && state.lastUserNavAt >= pending.at) return { action: 'drop' }
  const waited = input.now - pending.at
  if (waited >= maxWaitMs) return { action: 'drop' }
  if (waited < settleMs) return { action: 'wait', retryInMs: settleMs - waited }
  if (!input.hasViewerApi || !input.viewerReady) return { action: 'wait', retryInMs: Math.min(250, maxWaitMs - waited) }
  return { action: 'go' }
}

// ---------------------------------------------------------------------------
// Director's acknowledgements: build_phase frames the narration reducer does not know
// ---------------------------------------------------------------------------

export interface FlowSignals {
  buildId: string | null
  /** A `settled` frame arrived for this build, at this time (ms). */
  settledAt: number | null
  /** A message sent while paused was queued; it applies on resume. */
  steerPending: boolean
  /** Slides (0-based) the resume's changes were applied to; null when Director did not say; [] when it said none (Slide Builder already holds the deck). */
  appliedTo: number[] | null
  appliedAt: number | null
}

/** How long "Applied to slides N–M" stays up. */
export const FLOW_APPLIED_HOLD_MS = 8000
/** How long "These changes couldn't be applied…" stays up: it asks the user to do something, so it stays longer. */
export const FLOW_NOT_APPLIED_HOLD_MS = 20000

/** Director acknowledged the resume's changes and applied them to no slide (they were all already in progress). */
export const FLOW_NOT_APPLIED_LINE = "These changes couldn't be applied to slides already in progress — use Rebuild to apply them."

export function flowAppliedHoldMs(appliedTo: readonly number[] | null | undefined): number {
  return appliedTo && appliedTo.length === 0 ? FLOW_NOT_APPLIED_HOLD_MS : FLOW_APPLIED_HOLD_MS
}

export function initialFlowSignals(): FlowSignals {
  return { buildId: null, settledAt: null, steerPending: false, appliedTo: null, appliedAt: null }
}

/** `settled` is a phase the narration reducer must never see (it would read as "running"). */
export function isFlowSettledPhase(payload: { phase?: unknown } | null | undefined): boolean {
  return Boolean(payload) && payload!.phase === 'settled'
}

function appliedIndexes(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  if (value.length === 0) return [] // "applied to none": said plainly, not the same as not saying
  const indexes = value.filter(isSlideIndex)
  if (!indexes.length || indexes.length !== value.length) return null
  return Array.from(new Set(indexes)).sort((a, b) => a - b)
}

/**
 * Fold one build_phase frame into the signals. A new build resets them. `settled` stamps settledAt; a paused frame
 * with steer_pending:true marks the queued changes (a plain paused frame leaves the mark alone: a repeated ack must
 * not drop it); `building` ends the steer and carries applied_to; any other phase ends the steer.
 */
export function flowSignalsReduce(signals: FlowSignals, payload: {
  build_id?: unknown; phase?: unknown; steer_pending?: unknown; applied_to?: unknown
} | null | undefined, now: number): FlowSignals {
  if (!payload || typeof payload !== 'object') return signals
  const buildId = typeof payload.build_id === 'string' && payload.build_id ? payload.build_id : null
  let next = signals
  if (buildId && signals.buildId !== buildId) next = { ...initialFlowSignals(), buildId }
  const phase = payload.phase
  if (phase === 'settled') return { ...next, settledAt: now }
  if (phase === 'paused') return payload.steer_pending === true ? { ...next, steerPending: true } : next
  if (phase === 'building') {
    const applied = appliedIndexes(payload.applied_to)
    return { ...next, steerPending: false, appliedTo: applied, appliedAt: applied !== null ? now : null }
  }
  if (typeof phase === 'string' && next.steerPending) return { ...next, steerPending: false }
  return next
}

/** "Applied to slides 4–7." / "Applied to slide 4." / "Applied to slides 4, 6 and 9." (1-based for the reader); for no slide at all, the plain words that say so. */
export function flowAppliedLabel(appliedTo: readonly number[] | null | undefined): string | null {
  if (!appliedTo) return null
  if (!appliedTo.length) return FLOW_NOT_APPLIED_LINE
  const numbers = Array.from(new Set(appliedTo.filter(isSlideIndex).map(index => index + 1))).sort((a, b) => a - b)
  if (!numbers.length) return null
  if (numbers.length === 1) return `Applied to slide ${numbers[0]}.`
  const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1)
  if (contiguous) return `Applied to slides ${numbers[0]}–${numbers[numbers.length - 1]}.`
  return `Applied to slides ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}.`
}

// ---------------------------------------------------------------------------
// Flow amend
// ---------------------------------------------------------------------------

export type FlowAmendControl =
  | 'running'
  | 'pause_requested'
  | 'paused'
  | 'resume_requested'
  | 'stop_requested'
  | 'stopped'

export type FlowAmendLineKey =
  | 'pause_requested' | 'paused' | 'steer_queued' | 'resuming' | 'stopping' | 'stopped' | 'rebuilding' | 'applied' | 'not_applied'

/** The calm one-liner in the chat for each state. */
export const FLOW_AMEND_LINES: Record<Exclude<FlowAmendLineKey, 'applied' | 'not_applied'>, string> = {
  pause_requested: 'Pausing the build…',
  paused: 'Paused — type changes, then Resume or Rebuild.',
  steer_queued: 'Changes queued for resume.',
  resuming: 'Resuming the build…',
  stopping: 'Stopping the build…',
  stopped: 'Stopped — your finished slides are kept. Type changes, then Rebuild or Resume.',
  // Stop first, then the draft goes once Director says the last slide is done (or, if it never says, after a short wait).
  rebuilding: 'Rebuilding once the last slide finishes…',
}
/** The rebuild line once the draft has been sent. */
export const FLOW_AMEND_REBUILD_SENT_LINE = 'Rebuilding with your changes…'

export const FLOW_AMEND_RESUME_LABEL = 'Resume'
export const FLOW_AMEND_RESUME_WITH_CHANGES_LABEL = 'Resume with these changes'
export const FLOW_AMEND_REBUILD_LABEL = 'Rebuild with these instructions'
export const FLOW_AMEND_REBUILD_NEEDS_TEXT = 'Type your changes first'
/** build_control `instructions` is capped by Director at this many characters. */
export const FLOW_AMEND_INSTRUCTIONS_MAX = 1000
export const FLOW_AMEND_INSTRUCTIONS_TRUNCATED_HINT = `Only the first ${FLOW_AMEND_INSTRUCTIONS_MAX} characters are sent.`

export interface FlowRebuild {
  /** The instructions, as typed when the button was pressed. */
  text: string
  /** The build that was running; a different build means this rebuild is over. */
  buildId: string | null
  /** stopping: stop sent. awaiting_settled: Director said stopped. sent: the draft went out. */
  stage: 'stopping' | 'awaiting_settled' | 'sent'
  startedAt: number
  stoppedAt: number | null
  sentAt: number | null
}

/** The stop request is given this long to show up as the control state before a missing one reads as a failed stop. */
export const FLOW_REBUILD_STOP_GRACE_MS = 750
/** After `stopped`, wait this long for `settled`; Director with the flag off never sends it, and the draft waits behind its lock anyway. */
export const FLOW_REBUILD_SETTLE_WAIT_MS = 8000
/** After the draft is sent, "Rebuilding…" stays until the new build shows or this long has passed. */
export const FLOW_REBUILD_SENT_HOLD_MS = 10000

export interface FlowAmendState {
  /** Draw the status line (and buttons, where shown). */
  visible: boolean
  key: FlowAmendLineKey | null
  line: string
  /** The composer may send now: the turn gate is not in the way. */
  canSend: boolean
  showResume: boolean
  resumeEnabled: boolean
  resumeLabel: string
  resumeHint: string | null
  showRebuild: boolean
  rebuildEnabled: boolean
  rebuildHint: string | null
}

const HIDDEN: FlowAmendState = {
  visible: false,
  key: null,
  line: '',
  canSend: false,
  showResume: false,
  resumeEnabled: false,
  resumeLabel: FLOW_AMEND_RESUME_LABEL,
  resumeHint: null,
  showRebuild: false,
  rebuildEnabled: false,
  rebuildHint: null,
}

function codePointLength(text: string): number {
  let count = 0
  for (const _ of text) count++
  return count
}

/**
 * What the chat shows for a build that is being steered. `active` is the narration being active (a build in flight or
 * halted); `control` is the narration's pause/stop state; `rebuild` is the page's pending rebuild, if any; `steerPending`
 * and `appliedTo` come from Director's build_phase frames (flowSignalsReduce).
 */
export function flowAmendState(input: {
  enabled: boolean
  active: boolean
  control: FlowAmendControl
  rebuild: FlowRebuild | null
  draft: string
  instructionsEnabled: boolean
  steerPending?: boolean
  appliedTo?: readonly number[] | null
}): FlowAmendState {
  if (!input.enabled || !input.active) return HIDDEN
  const draft = input.draft.trim()
  const hasDraft = draft.length > 0
  let key: FlowAmendLineKey | null = null
  if (input.rebuild) key = 'rebuilding'
  else if (input.control === 'pause_requested') key = 'pause_requested'
  else if (input.control === 'paused') key = input.steerPending ? 'steer_queued' : 'paused'
  else if (input.control === 'resume_requested') key = 'resuming'
  else if (input.control === 'stop_requested') key = 'stopping'
  else if (input.control === 'stopped') key = 'stopped'
  else if (input.control === 'running' && flowAppliedLabel(input.appliedTo)) key = input.appliedTo!.length === 0 ? 'not_applied' : 'applied'
  if (key === null) return HIDDEN
  const halted = key === 'paused' || key === 'steer_queued' || key === 'stopped'
  // Changes that could not be applied to slides in progress can still be applied by a rebuild: that button, and only that one, stays.
  const canRebuild = halted || key === 'not_applied'
  const withChanges = input.instructionsEnabled && hasDraft
  return {
    visible: true,
    key,
    line: key === 'applied' || key === 'not_applied'
      ? flowAppliedLabel(input.appliedTo) as string
      : key === 'rebuilding' && input.rebuild?.stage === 'sent' ? FLOW_AMEND_REBUILD_SENT_LINE : FLOW_AMEND_LINES[key],
    // The turn gate lets a message through while the build is held; while rebuilding the page sends the draft itself.
    canSend: halted || key === 'rebuilding',
    showResume: halted,
    resumeEnabled: halted,
    resumeLabel: withChanges ? FLOW_AMEND_RESUME_WITH_CHANGES_LABEL : FLOW_AMEND_RESUME_LABEL,
    resumeHint: halted && withChanges && codePointLength(draft) > FLOW_AMEND_INSTRUCTIONS_MAX ? FLOW_AMEND_INSTRUCTIONS_TRUNCATED_HINT : null,
    showRebuild: canRebuild,
    rebuildEnabled: canRebuild && hasDraft,
    rebuildHint: canRebuild && !hasDraft ? FLOW_AMEND_REBUILD_NEEDS_TEXT : null,
  }
}

/**
 * The text Resume carries to Director: only with the instructions flag, only a non-empty draft, trimmed and cut to
 * Director's 1000 characters (by character, never inside a surrogate pair).
 */
export function flowResumeInstructions(input: { instructionsEnabled: boolean; draft: string }): string | undefined {
  if (!input.instructionsEnabled) return undefined
  const text = input.draft.trim()
  if (!text) return undefined
  const characters = Array.from(text)
  return characters.length > FLOW_AMEND_INSTRUCTIONS_MAX ? characters.slice(0, FLOW_AMEND_INSTRUCTIONS_MAX).join('') : text
}

export type FlowRebuildStep = 'none' | 'wait' | 'stopped' | 'send' | 'cancel' | 'done'

/** How long until flowRebuildStep can answer differently with nothing else changing (null = only a new input can: the deadline is past or there is none). */
export function flowRebuildWakeInMs(rebuild: FlowRebuild | null, now: number): number | null {
  if (!rebuild) return null
  const at = rebuild.stage === 'stopping' ? rebuild.startedAt + FLOW_REBUILD_STOP_GRACE_MS
    : rebuild.stage === 'awaiting_settled' ? (rebuild.stoppedAt ?? now) + FLOW_REBUILD_SETTLE_WAIT_MS
      : (rebuild.sentAt ?? now) + FLOW_REBUILD_SENT_HOLD_MS
  return at > now ? at - now : null
}

/**
 * Rebuild = stop, wait for Director's `stopped` and then for a NEW `settled` (the build turn really returned), then send
 * the draft as an ordinary message.
 *  - 'stopped': the stop was acknowledged; start waiting for `settled` (the page stamps stoppedAt).
 *  - 'send': `settled` arrived after the rebuild began, or it did not within FLOW_REBUILD_SETTLE_WAIT_MS (Director with
 *    its flag off never sends it; the message waits behind the lock there, exactly as it would have).
 *  - 'cancel': it cannot happen any more (another build, the build ended, the stop was not acknowledged and the control
 *    fell back, the build is not stopped any more).
 *  - 'done': the sent draft has been followed by a new build, or the hold ran out.
 */
export function flowRebuildStep(input: {
  rebuild: FlowRebuild | null
  control: FlowAmendControl
  phase: string
  buildId: string | null
  now: number
  settledAt?: number | null
}): FlowRebuildStep {
  const { rebuild } = input
  if (!rebuild) return 'none'
  if (rebuild.buildId && input.buildId && rebuild.buildId !== input.buildId) {
    return rebuild.stage === 'sent' ? 'done' : 'cancel'
  }
  const stopped = input.control === 'stopped' || input.phase === 'stopped'
  const settled = input.settledAt !== null && input.settledAt !== undefined && input.settledAt >= rebuild.startedAt
  if (rebuild.stage === 'sent') {
    if (!stopped) return 'done'
    if (rebuild.sentAt !== null && input.now - rebuild.sentAt >= FLOW_REBUILD_SENT_HOLD_MS) return 'done'
    return 'wait'
  }
  if (rebuild.stage === 'awaiting_settled') {
    if (!stopped) return 'cancel'
    if (settled) return 'send'
    return rebuild.stoppedAt !== null && input.now - rebuild.stoppedAt >= FLOW_REBUILD_SETTLE_WAIT_MS ? 'send' : 'wait'
  }
  if (stopped) return settled ? 'send' : 'stopped'
  if (input.phase === 'complete' || input.phase === 'error' || input.phase === 'idle') return 'cancel'
  if (input.control === 'stop_requested') return 'wait'
  // Not stopped and no stop pending: either the request has not shown up yet, or it timed out and the control fell back.
  return input.now - rebuild.startedAt < FLOW_REBUILD_STOP_GRACE_MS ? 'wait' : 'cancel'
}
