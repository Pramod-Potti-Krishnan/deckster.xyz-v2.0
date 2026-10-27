// CHAT CLEAN (FRONTEND-1, P3-1 C "chat clean v3", 26 Oct): the Director chat as one quiet thread, in PK's v3 design
// (streams/frontend1/chat-design/v3): the user's turn is a right-aligned box in the one tinted colour, Director's words sit
// on the page with no box, label or time, the build is an outlined job card inline in the thread with a five-segment
// step strip and one latest line, the composer is a hairline box with a "+" options menu (attach, template, theme, research),
// two research toggle chips beside Send, an icon-only model button and Send <-> Stop, and a stopped build is a slim bar
// above the composer ("Stopped at slide 4 · slides 1-4 kept · Continue") while the composer stays free for new directions.
// Director's contract for a stopped build (DIRECTOR-2, Director !564, 26 Oct): a plain user_message after a stop is an ordinary
// chat turn and never rebuilds, so Enter with a draft while the build is held ALWAYS goes as build_control resume {instructions}
// (1000 characters at most); Director acknowledges with build_phase building + applied_to (the slides, 0-based), and an empty
// applied_to means nothing was left to build. This path does not depend on the NEXT_PUBLIC_STUDIO_FLOW_* flags.
// One flag, NEXT_PUBLIC_STUDIO_CHAT_CLEAN, the string "true", default off, build-time: off, nothing here is drawn, listened
// to or sent, and the chat is byte for byte what it was.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-chat-clean.mjs transpiles this file into a bare function scope with a fake
// `process`. Every decision the chat makes under the flag lives here as a pure function; the components only draw what
// these return, and the page only holds the state and does the I/O (sendBuildControl stop / resume, the resume's
// instructions through the flow bus, the build_phase acknowledgements).

// ---------------------------------------------------------------------------
// The flag (a literal process.env read so Next inlines it at build time)
// ---------------------------------------------------------------------------

export function chatCleanFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

export const STUDIO_CHAT_CLEAN_ENABLED = chatCleanFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN)

// ---------------------------------------------------------------------------
// PK's open choices: ONE token each, so each is a one-line change here. They reach the stylesheet as data attributes on
// the chat column (chatCleanRootAttributes) and the components read them directly.
// ---------------------------------------------------------------------------

export const CHAT_CLEAN_CHOICES = Object.freeze({
  /** The one accent (Send, the approved choice): 'graphite' = the ink (v3); 'violet' = the shell's --ss-accent. */
  accent: 'graphite' as 'graphite' | 'violet',
  /** The Stop button while a build runs: 'ink' (v3) or 'accent' (the button only changes its icon). */
  stop: 'ink' as 'ink' | 'accent',
  /** After a stop with a draft typed: which action is primary, 'send' (v3: Send in ink, Continue outlined) or 'continue'. */
  stoppedDraftPrimary: 'send' as 'send' | 'continue',
  /** A small "DIRECTOR" label with the spark above each Director turn: 'none' (v3) or 'small'. */
  directorLabel: 'none' as 'none' | 'small',
  /** The user's box: 'tint' = the pale violet (#f1edfb / #2b2742, the only hue in the panel, v3); 'neutral' = the grey (#eef1f0 / #26323a). */
  userBox: 'tint' as 'tint' | 'neutral',
  /** Deep research / web search: in the research options menu next to Send ('menu', v3.1), or as toggle chips beside Send too ('chips', the v3 study). */
  research: 'menu' as 'chips' | 'menu',
})

export type ChatCleanChoices = typeof CHAT_CLEAN_CHOICES

/** The attributes the chat column carries under the flag: the stylesheet's hook (data-studio-chat-clean) and each choice (named so that none collides with an element's own attribute: the Stop button is data-studio-chat-clean-stop). */
export function chatCleanRootAttributes(choices: ChatCleanChoices = CHAT_CLEAN_CHOICES): Record<string, string> {
  return {
    'data-studio-chat-clean': 'v3',
    'data-studio-chat-clean-accent': choices.accent,
    'data-studio-chat-clean-stop-colour': choices.stop,
    'data-studio-chat-clean-primary': choices.stoppedDraftPrimary,
    'data-studio-chat-clean-label': choices.directorLabel,
    'data-studio-chat-clean-user': choices.userBox,
    'data-studio-chat-clean-research': choices.research,
  }
}

/** The composer textarea's minimum height under the flag (the base's is 96px: a one-line box, as the v3 composer is). */
export const CHAT_CLEAN_TEXTAREA_MIN_HEIGHT = 40

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const CHAT_CLEAN_WORDS = Object.freeze({
  placeholderRunning: 'Stop to give new directions…',
  placeholderStopping: 'Stopping…',
  placeholderResuming: 'Resuming…',
  hintRunning: 'Stop keeps the finished slides · then continue, or send new directions',
  hintStopping: 'Stopping the build · the finished slides are kept',
  hintResuming: 'Resuming the build…',
  nothingLeft: 'Nothing left to build — every remaining slide was already in progress, so these directions were not applied.',
  continueLabel: 'Continue',
  stopLabel: 'Stop building',
  sendDirectionsLabel: 'Send directions',
  deepResearchItem: 'Deep research',
  deepResearchNote: 'Also turns on web search',
  webSearchItem: 'Web search',
  lockedNote: 'Locked for this deck — research already ran',
  stoppedTitle: 'Stopped',
  pausedTitle: 'Paused',
  stoppingTitle: 'Stopping',
  resumingTitle: 'Resuming',
  planningTitle: 'Planning your deck',
  outlineTitle: 'Shaping the outline',
  waitingTitle: 'Waiting for you',
  buildingTitle: 'Building slides',
  checkingTitle: 'Checking slides',
  packagingTitle: 'Packaging the deck',
  completeTitle: 'Deck ready',
  errorTitle: 'Something went wrong',
})

/** 1-based reader words for the finished slides: "slides 1–4 kept", "slide 1 kept", "no slide finished yet". */
export function chatCleanSlidesKept(slidesDone: number): string {
  const done = Number.isSafeInteger(slidesDone) && slidesDone > 0 ? slidesDone : 0
  if (done === 0) return 'no slide finished yet'
  if (done === 1) return 'slide 1 kept'
  return `slides 1–${done} kept`
}

/** Where a held build stands, for the reader: "Stopped at slide 5" (the next slide to build), or "Stopped after the last slide". */
export function chatCleanHeldAt(kind: 'stopped' | 'paused', slidesDone: number, slideCount: number): string {
  const word = kind === 'paused' ? 'Paused' : 'Stopped'
  const done = Number.isSafeInteger(slidesDone) && slidesDone > 0 ? slidesDone : 0
  const count = Number.isSafeInteger(slideCount) && slideCount > 0 ? slideCount : 0
  if (count > 0 && done >= count) return `${word} after the last slide`
  return `${word} at slide ${done + 1}`
}

/** The slide new directions apply from (1-based): the next one to build. */
export function chatCleanDirectionsFrom(slidesDone: number, slideCount: number): number {
  const done = Number.isSafeInteger(slidesDone) && slidesDone > 0 ? slidesDone : 0
  const count = Number.isSafeInteger(slideCount) && slideCount > 0 ? slideCount : 0
  return count > 0 ? Math.min(done + 1, count) : done + 1
}

/** mm:ss of an elapsed span (never negative). */
export function chatCleanElapsed(startedAt: number | null, now: number): string | null {
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

// ---------------------------------------------------------------------------
// The composer: Send <-> Stop, the slim bar, what Enter does while a build is held
// ---------------------------------------------------------------------------

export type ChatCleanComposerMode = 'idle' | 'running' | 'stopping' | 'held' | 'resuming'

/** What Enter / the Send button do: the base's message ('message'), build_control resume with the draft as instructions (held), or nothing ('wait'). */
export type ChatCleanSendMode = 'message' | 'instructions' | 'wait'

export interface ChatCleanComposerInput {
  /** The flag, the Studio shell and the narration canvas (NEXT_PUBLIC_BUILD_NARRATION) are all on. */
  enabled: boolean
  /** NarrationState.active / phase / control / slidesDone / slideCount. */
  active: boolean
  phase: string
  control: string
  slidesDone: number
  slideCount: number
  /** NEXT_PUBLIC_BUILD_CONTROL: without it nothing can stop or resume a build. */
  controlEnabled: boolean
  /** Director's acknowledgement of the last directions (chatCleanAckState), while it shows: 'applied' / 'not_applied' and its line, or null. */
  ackKey: ChatCleanAckKey | null
  ackLine: string
}

export interface ChatCleanComposerState {
  mode: ChatCleanComposerMode
  /** The square Stop button stands where Send stands. */
  showStop: boolean
  stopEnabled: boolean
  /** The slim bar above the composer: its words (null = no bar). */
  barText: string | null
  barDetail: string | null
  /** Continue (resume as planned) in the bar. */
  showContinue: boolean
  continueEnabled: boolean
  sendMode: ChatCleanSendMode
  /** The composer placeholder and the hint under the box (null = the base's own). */
  placeholder: string | null
  hint: string | null
  /** 1-based: the slide new directions apply from (held only). */
  directionsFrom: number | null
  /** The context line's words for the held state ("New directions apply from slide 4"), or null. */
  context: string | null
}

const COMPOSER_IDLE: ChatCleanComposerState = Object.freeze({
  mode: 'idle', showStop: false, stopEnabled: false, barText: null, barDetail: null, showContinue: false, continueEnabled: false,
  sendMode: 'message', placeholder: null, hint: null, directionsFrom: null, context: null,
})

const RUNNING_PHASES = ['planning', 'strawman', 'building', 'qa', 'finalizing']

/** Director's acknowledgement of the last directions (applied / nothing left to build) is the hint while it shows. */
export function chatCleanComposerState(input: ChatCleanComposerInput): ChatCleanComposerState {
  if (!input.enabled || !input.active) return COMPOSER_IDLE
  const { phase, control } = input
  if (phase === 'complete' || phase === 'error' || phase === 'idle' || phase === 'awaiting_user') return COMPOSER_IDLE
  const held = control === 'stopped' || control === 'paused' || phase === 'stopped' || phase === 'paused'
  const from = chatCleanDirectionsFrom(input.slidesDone, input.slideCount)
  if (control === 'stop_requested') {
    return {
      ...COMPOSER_IDLE, mode: 'stopping', showStop: true, stopEnabled: false, sendMode: 'message',
      placeholder: CHAT_CLEAN_WORDS.placeholderStopping, hint: CHAT_CLEAN_WORDS.hintStopping,
    }
  }
  if (control === 'resume_requested') {
    const kind = phase === 'paused' ? 'paused' : 'stopped'
    return {
      ...COMPOSER_IDLE, mode: 'resuming', barText: CHAT_CLEAN_WORDS.resumingTitle, barDetail: chatCleanSlidesKept(input.slidesDone),
      showContinue: true, continueEnabled: false, sendMode: 'wait', placeholder: CHAT_CLEAN_WORDS.placeholderResuming,
      hint: CHAT_CLEAN_WORDS.hintResuming, directionsFrom: from, context: `${chatCleanHeldAt(kind, input.slidesDone, input.slideCount)}`,
    }
  }
  if (held) {
    const kind = control === 'paused' || (control !== 'stopped' && phase === 'paused') ? 'paused' : 'stopped'
    // Director's contract: a plain message after a stop never rebuilds, so a draft always goes as the resume's instructions (the control flag gates the send, as Continue).
    return {
      mode: 'held', showStop: false, stopEnabled: false,
      barText: chatCleanHeldAt(kind, input.slidesDone, input.slideCount), barDetail: chatCleanSlidesKept(input.slidesDone),
      showContinue: true, continueEnabled: input.controlEnabled, sendMode: input.controlEnabled ? 'instructions' : 'wait',
      placeholder: `New directions from slide ${from}…`, hint: input.controlEnabled ? `Enter sends new directions from slide ${from} · Continue resumes as planned` : `${chatCleanSlidesKept(input.slidesDone)} · the build cannot be resumed from here`,
      directionsFrom: from, context: `New directions apply from slide ${from}`,
    }
  }
  if (RUNNING_PHASES.includes(phase) && control === 'running') {
    if (!input.controlEnabled) return COMPOSER_IDLE
    return {
      ...COMPOSER_IDLE, mode: 'running', showStop: true, stopEnabled: true, sendMode: 'message',
      placeholder: CHAT_CLEAN_WORDS.placeholderRunning, hint: input.ackKey && input.ackLine ? input.ackLine : CHAT_CLEAN_WORDS.hintRunning,
    }
  }
  return COMPOSER_IDLE
}

// ---------------------------------------------------------------------------
// The resume's instructions and Director's acknowledgement of them
// ---------------------------------------------------------------------------

/** build_control `instructions` is capped by Director at this many characters. */
export const CHAT_CLEAN_INSTRUCTIONS_MAX = 1000

/** The draft as the resume's instructions: trimmed and cut to Director's 1000 characters (by character, never inside a surrogate pair); null for an empty draft. */
export function chatCleanInstructions(draft: string): string | null {
  const text = typeof draft === 'string' ? draft.trim() : ''
  if (!text) return null
  const characters = Array.from(text)
  return characters.length > CHAT_CLEAN_INSTRUCTIONS_MAX ? characters.slice(0, CHAT_CLEAN_INSTRUCTIONS_MAX).join('') : text
}

export type ChatCleanAckKey = 'applied' | 'not_applied'

export interface ChatCleanAck {
  buildId: string | null
  /** The slides (0-based) Director applied the directions to; [] when it said nothing was left to build. */
  appliedTo: number[]
  at: number
}

/** How long the acknowledgement stays as the hint: a plain "applied" for a moment, "nothing left to build" longer (it answers the user). */
export const CHAT_CLEAN_ACK_HOLD_MS = Object.freeze({ applied: 8000, not_applied: 20000 })

/** Fold one build_phase frame into the acknowledgement: only a `building` frame that carries applied_to is one (Director's answer to resume {instructions}); anything else leaves it alone. */
export function chatCleanAckReduce(ack: ChatCleanAck | null, payload: { build_id?: unknown; phase?: unknown; applied_to?: unknown } | null | undefined, now: number): ChatCleanAck | null {
  if (!payload || typeof payload !== 'object' || payload.phase !== 'building' || !Array.isArray(payload.applied_to)) return ack
  const indexes = (payload.applied_to as unknown[]).filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  if (indexes.length !== payload.applied_to.length) return ack
  return { buildId: typeof payload.build_id === 'string' && payload.build_id ? payload.build_id : null, appliedTo: Array.from(new Set(indexes)).sort((a, b) => a - b), at: now }
}

/** "Applied to slides 5–8." / "Applied to slide 4." / "Applied to slides 4, 6 and 9." (1-based for the reader), or the honest line for nothing left to build. */
export function chatCleanAppliedLine(appliedTo: readonly number[]): string {
  if (!appliedTo.length) return CHAT_CLEAN_WORDS.nothingLeft
  const numbers = Array.from(new Set(appliedTo.map(index => index + 1))).sort((a, b) => a - b)
  if (numbers.length === 1) return `Applied to slide ${numbers[0]}.`
  const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1)
  if (contiguous) return `Applied to slides ${numbers[0]}–${numbers[numbers.length - 1]}.`
  return `Applied to slides ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}.`
}

/** The acknowledgement as the composer and the notes read it, while it holds; null once it has expired or there is none. */
export function chatCleanAckState(ack: ChatCleanAck | null, now: number): { key: ChatCleanAckKey; line: string } | null {
  if (!ack) return null
  const key: ChatCleanAckKey = ack.appliedTo.length ? 'applied' : 'not_applied'
  if (now - ack.at >= CHAT_CLEAN_ACK_HOLD_MS[key]) return null
  return { key, line: chatCleanAppliedLine(ack.appliedTo) }
}

// ---------------------------------------------------------------------------
// The job card: title, meta, the five segments, the one line
// ---------------------------------------------------------------------------

export type ChatCleanSegmentState = 'done' | 'now' | 'held' | 'todo'

export interface ChatCleanSegment {
  label: 'Plan' | 'Outline' | 'Build' | 'Check' | 'Package'
  state: ChatCleanSegmentState
  /** 0-1: how much of the segment is filled when it is the current one (the Build segment follows the slide tally). */
  fill: number
}

export type ChatCleanJobIcon = 'brush' | 'stop' | 'pause' | 'clock' | 'check' | 'alert' | 'compass' | 'list'

export interface ChatCleanJobInput {
  phase: string
  control: string
  phaseLabel: string
  slidesDone: number
  slideCount: number
  /** The newest deck event's text, or null. */
  latestEventText: string | null
  latestEventStatus: string | null
}

export interface ChatCleanJobModel {
  title: string
  icon: ChatCleanJobIcon
  /** "4 of 10" / "4 of 10 built" / null; the elapsed clock is appended by the component. */
  tally: string | null
  halted: boolean
  /** The clock stands still (held, waiting, over). */
  clockFrozen: boolean
  segments: ChatCleanSegment[]
  line: string
}

const SEGMENT_INDEX: Record<string, number> = { planning: 0, strawman: 1, awaiting_user: 1, building: 2, qa: 3, finalizing: 4, complete: 5, paused: 2, stopped: 2, error: -1 }

export function chatCleanJobSegments(input: Pick<ChatCleanJobInput, 'phase' | 'control' | 'slidesDone' | 'slideCount'>): ChatCleanSegment[] {
  const labels: ChatCleanSegment['label'][] = ['Plan', 'Outline', 'Build', 'Check', 'Package']
  const held = input.control === 'stopped' || input.control === 'paused' || input.phase === 'stopped' || input.phase === 'paused'
  const at = input.phase in SEGMENT_INDEX ? SEGMENT_INDEX[input.phase] : -1
  const done = Number.isSafeInteger(input.slidesDone) && input.slidesDone > 0 ? input.slidesDone : 0
  const count = Number.isSafeInteger(input.slideCount) && input.slideCount > 0 ? input.slideCount : 0
  return labels.map((label, index) => {
    if (at < 0) return { label, state: 'todo', fill: 0 }
    if (index < at) return { label, state: 'done', fill: 1 }
    if (index > at) return { label, state: 'todo', fill: 0 }
    const fill = index === 2 && count > 0 ? Math.max(0.1, Math.min(1, done / count)) : 0.4
    return { label, state: held ? 'held' : 'now', fill }
  })
}

export function chatCleanJobModel(input: ChatCleanJobInput): ChatCleanJobModel {
  const { phase, control } = input
  const held = control === 'stopped' || control === 'paused' || phase === 'stopped' || phase === 'paused'
  const stopped = control === 'stopped' || (control !== 'paused' && phase === 'stopped')
  const count = Number.isSafeInteger(input.slideCount) && input.slideCount > 0 ? input.slideCount : 0
  const done = Number.isSafeInteger(input.slidesDone) && input.slidesDone > 0 ? input.slidesDone : 0
  const segments = chatCleanJobSegments(input)
  const W = CHAT_CLEAN_WORDS
  let title: string, icon: ChatCleanJobIcon
  if (control === 'stop_requested') { title = W.stoppingTitle; icon = 'stop' }
  else if (control === 'resume_requested') { title = W.resumingTitle; icon = 'brush' }
  else if (held) { title = stopped ? W.stoppedTitle : W.pausedTitle; icon = stopped ? 'stop' : 'pause' }
  else if (phase === 'planning') { title = W.planningTitle; icon = 'compass' }
  else if (phase === 'strawman') { title = W.outlineTitle; icon = 'list' }
  else if (phase === 'awaiting_user') { title = W.waitingTitle; icon = 'clock' }
  else if (phase === 'building') { title = W.buildingTitle; icon = 'brush' }
  else if (phase === 'qa') { title = W.checkingTitle; icon = 'check' }
  else if (phase === 'finalizing') { title = W.packagingTitle; icon = 'brush' }
  else if (phase === 'complete') { title = W.completeTitle; icon = 'check' }
  else if (phase === 'error') { title = W.errorTitle; icon = 'alert' }
  else { title = input.phaseLabel || W.buildingTitle; icon = 'brush' }
  const tally = count > 0 && ['building', 'qa', 'finalizing', 'paused', 'stopped', 'complete'].includes(phase)
    ? held ? `${done} of ${count} built` : `${done} of ${count}` : null
  const over = phase === 'complete' || phase === 'error'
  let line: string
  if (held && stopped) line = `Stopped while working on slide ${chatCleanDirectionsFrom(done, count)}.`
  else if (held) line = `Paused before slide ${chatCleanDirectionsFrom(done, count)}.`
  else if (phase === 'error') line = input.latestEventStatus === 'error' && input.latestEventText ? input.latestEventText : (input.phaseLabel || W.errorTitle)
  else line = input.latestEventText || input.phaseLabel || title
  return { title, icon, tally, halted: held, clockFrozen: held || over || phase === 'awaiting_user' || control === 'stop_requested', segments, line }
}

// ---------------------------------------------------------------------------
// Thread notes: the record of stop / resume / applied, kept by the page and drawn at the end of the thread
// ---------------------------------------------------------------------------

export type ChatCleanNoteKind = 'stopped' | 'paused' | 'resumed' | 'applied' | 'not_applied' | 'directions'

export interface ChatCleanNote {
  id: string
  kind: ChatCleanNoteKind
  text: string
  at: number
  buildId: string | null
}

export interface ChatCleanNarrationSnapshot {
  active: boolean
  buildId: string | null
  phase: string
  control: string
  slidesDone: number
  slideCount: number
}

/** At most this many notes are kept (the oldest go). */
export const CHAT_CLEAN_NOTES_MAX = 40

const isHeld = (s: ChatCleanNarrationSnapshot | null) => Boolean(s && (s.control === 'stopped' || s.control === 'paused' || s.phase === 'stopped' || s.phase === 'paused'))
const isStoppedKind = (s: ChatCleanNarrationSnapshot) => s.control === 'stopped' || (s.control !== 'paused' && s.phase === 'stopped')

/** "Applied to slides 5–8." (chatCleanAppliedLine) -> "new directions applied to slides 5–8". */
export function chatCleanAppliedPhrase(amendLine: string): string | null {
  const m = /^Applied to (slides? .+?)\.?$/.exec(amendLine.trim())
  return m ? `new directions applied to ${m[1]}` : null
}

/**
 * Fold a narration change into the notes. A build that becomes held adds "Stopped at slide 5 · slides 1–4 kept"; a held
 * build that runs again adds "Resumed · building from slide 5" (or, when Director's acknowledgement already named the slides,
 * "Resumed · new directions applied to slides 5–8"); an applied acknowledgement that arrives after the resume note completes
 * that note; "not applied" adds Director's own line. Nothing repeats for the same state.
 */
export function chatCleanNotesReduce(notes: readonly ChatCleanNote[], previous: ChatCleanNarrationSnapshot | null, next: ChatCleanNarrationSnapshot, now: number, amend: { key: ChatCleanAckKey | null; line: string } = { key: null, line: '' }): ChatCleanNote[] {
  let out = notes.slice()
  const push = (kind: ChatCleanNoteKind, text: string) => { out = [...out, { id: `${kind}:${now}:${out.length}`, kind, text, at: now, buildId: next.buildId }].slice(-CHAT_CLEAN_NOTES_MAX) }
  const last = () => out[out.length - 1]
  if (!next.active) return out
  const wasHeld = isHeld(previous), nowHeld = isHeld(next)
  if (nowHeld && !wasHeld) {
    const kind: ChatCleanNoteKind = isStoppedKind(next) ? 'stopped' : 'paused'
    push(kind, `${chatCleanHeldAt(kind, next.slidesDone, next.slideCount)} · ${chatCleanSlidesKept(next.slidesDone)}`)
    return out
  }
  if (wasHeld && !nowHeld && next.control === 'running' && previous && previous.buildId === next.buildId) {
    const applied = amend.key === 'applied' ? chatCleanAppliedPhrase(amend.line) : null
    push('resumed', applied ? `Resumed · ${applied}` : `Resumed · building from slide ${chatCleanDirectionsFrom(next.slidesDone, next.slideCount)}`)
    return out
  }
  if (amend.key === 'applied') {
    const phrase = chatCleanAppliedPhrase(amend.line)
    const tail = last()
    if (phrase && tail && tail.kind === 'resumed' && tail.buildId === next.buildId && !tail.text.includes('applied to')) {
      out = [...out.slice(0, -1), { ...tail, text: `Resumed · ${phrase}` }]
    } else if (phrase && !(tail && tail.kind === 'applied' && tail.text === phrase)) {
      if (!(tail && tail.kind === 'resumed' && tail.text.includes(phrase))) push('applied', phrase.charAt(0).toUpperCase() + phrase.slice(1))
    }
    return out
  }
  if (amend.key === 'not_applied' && amend.line) {
    const tail = last()
    if (!(tail && tail.kind === 'not_applied' && tail.text === amend.line && tail.buildId === next.buildId)) push('not_applied', amend.line)
  }
  return out
}

/** The user's new directions, sent as instructions (never a chat message): kept in the thread as the user's own box. */
export function chatCleanDirectionsNote(notes: readonly ChatCleanNote[], text: string, buildId: string | null, now: number): ChatCleanNote[] {
  const clean = text.trim()
  if (!clean) return notes.slice()
  const note: ChatCleanNote = { id: `directions:${now}:${notes.length}`, kind: 'directions', text: clean, at: now, buildId }
  return [...notes, note].slice(-CHAT_CLEAN_NOTES_MAX)
}

// ---------------------------------------------------------------------------
// Director's plain status, when no build narration is active
// ---------------------------------------------------------------------------

/** The one muted line for an ordinary turn Director is working on (thinking / generating), or null. */
export function chatCleanStatusLine(narrationActive: boolean, status: { status?: string; text?: string } | null | undefined): string | null {
  if (narrationActive || !status) return null
  if (status.status !== 'thinking' && status.status !== 'generating') return null
  return status.text && status.text.trim() ? status.text.trim() : 'Working on it…'
}

// ---------------------------------------------------------------------------
// What the page hands the two components (the props travel through one spread each, so with the flag off nothing is added)
// ---------------------------------------------------------------------------

export interface ChatCleanComposerProps {
  composer: ChatCleanComposerState
  onStop: () => void
  onSendDirections: () => void
  sessionId: string | null
}

export interface ChatCleanThreadProps {
  narration: ChatCleanNarrationSnapshot & { phaseLabel: string; startedAt: number | null; deckEvents: ReadonlyArray<{ text: string; status: string }> }
  notes: readonly ChatCleanNote[]
  composer: ChatCleanComposerState
}
