// W6 P4-20 "voice call UI" (FRONTEND-1): flag NEXT_PUBLIC_STUDIO_VOICE_CALL (the exact string "true", default off, build-time), optional NEXT_PUBLIC_STUDIO_VOICE_COMPANION (the pack name under public/companions/, default "bob").
// The contract it follows is DIRECTOR-2's FINAL P4-18 schema (mail to ELEMENT-3, 2 Nov 01:56Z; Director setting DIRECTOR_VOICE_CONTRACT_ENABLED): the Director never touches audio. Studio adds the client cap "voice1" and sends
// the transcript as an ordinary user_message with data.mode "voice"; a typed user_message (no mode) ends voice mode. Only in voice mode, on frames that exist today, the Director adds payload.spoken (plain text) to a
// chat_message (two sentences at most) and to a deck-scope status_update / build_phase / build_event (about 120 characters, never filler), and payload.companion_state (thinking | working | reporting | pleased | concerned
// | waiting; "listening" is client-only). Studio speaks only payload.spoken, and drives the character from companion_state when it is there, from the frame's own type when it is not. The clip table is Garud's
// ("Director states -> clips", COMPANION_CHARACTERS.md), accepted by FRONTEND-1.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-voice-call.mjs transpiles this file into a bare function scope with a fake `process`. Everything the call decides lives here as a pure function (frame -> signal,
// signal -> scene, scene -> clip plan, clip -> frame at a time, mouth shape from a level, the chip, the controls, the errors, the pack framing); the controller (lib/studio-voice-call-controller.ts) does the I/O,
// the hook (hooks/use-studio-voice-call.ts) holds the state and the components draw it. The flag is read here, with a literal process.env read so Next inlines it, so a page with the flag off imports nothing of the core.

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

export function voiceCallFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** A pack name is a folder under public/companions/: lower-case letters, digits and dashes only, so it can never walk out of that folder. Anything else is the default. */
export const DEFAULT_COMPANION = 'felix'
export function companionNameFrom(value: string | undefined): string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(value) ? value : DEFAULT_COMPANION
}
/** The characters a person can switch between (their packs are committed under public/companions/): Felix, the default, Bob and Maya. The build's own default (NEXT_PUBLIC_STUDIO_VOICE_COMPANION) is always one of them. */
export const COMPANION_CHOICES: readonly string[] = ['felix', 'bob', 'maya']
export const COMPANION_STORAGE_KEY = 'deckster.studio.voiceCompanion'
export function companionChoices(fallback: string): string[] {
  return [...new Set([fallback, ...COMPANION_CHOICES])]
}
/** What a device remembers (localStorage, read inside try/catch: a private window, blocked site data or no storage at all is simply the default). Only a character that is on offer is believed. */
export interface CompanionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function readCompanionChoice(storage: CompanionStorage | null | undefined, fallback: string): string {
  try {
    const stored = storage?.getItem(COMPANION_STORAGE_KEY)
    return typeof stored === 'string' && companionChoices(fallback).includes(stored) ? stored : fallback
  } catch { return fallback }
}
export function writeCompanionChoice(storage: CompanionStorage | null | undefined, name: string, fallback: string): boolean {
  try {
    if (!storage || !companionChoices(fallback).includes(name)) return false
    storage.setItem(COMPANION_STORAGE_KEY, name)
    return true
  } catch { return false }
}
/** The next character: the one after `current` in the list on offer (back to the first at the end). One tap on the call's character switch cycles through all of them (Felix, Bob, Maya, Felix ...). */
export function nextCompanion(current: string, choices: readonly string[]): string {
  const at = choices.indexOf(current)
  return choices.length ? choices[(at + 1) % choices.length]! : current
}

export const STUDIO_VOICE_CALL_UI_ENABLED = voiceCallFlagOn(process.env.NEXT_PUBLIC_STUDIO_VOICE_CALL)
export const STUDIO_VOICE_COMPANION = companionNameFrom(process.env.NEXT_PUBLIC_STUDIO_VOICE_COMPANION)

// ---------------------------------------------------------------------------
// The wire (Studio -> Director)
// ---------------------------------------------------------------------------

export const VOICE_TURN_MODE = 'voice'
export const VOICE_CAP = 'voice1'

/** Frames Director sends that the call listens to (the socket hook shows them to the call, for this socket's session only). */
export const VOICE_CALL_FRAME_TYPES: readonly string[] = ['status_update', 'build_phase', 'build_event', 'slide_progress', 'chat_message', 'slide_built', 'slide_failed', 'action_request']
export function isVoiceCallFrameType(type: unknown): boolean {
  return typeof type === 'string' && VOICE_CALL_FRAME_TYPES.includes(type)
}

/**
 * The bus between the socket hook and the page's call hook (the page's older pins read the socket hook by position, so the two meet here):
 *   frame    the call's listener for Director's frames;
 *   sent     the socket hook says a user_message with mode "voice" went out (its text), so the call knows Director has it;
 *   pending  the words of the voice turn the call is sending right now: only the one user_message with exactly that text carries mode "voice".
 */
export const voiceCallBus: {
  frame: ((frame: unknown) => void) | null
  sent: ((text: string) => void) | null
  pending: { text: string } | null
} = { frame: null, sent: null, pending: null }

/** The call is about to send these words as a voice turn through the page's ordinary send. */
export function armVoiceTurn(text: string): void {
  voiceCallBus.pending = { text }
}

/** The send path asks, once, whether the user_message it is building is the armed voice turn (same words). Taken whether or not it matches a later message: it is consumed by the first message with its text. */
export function takeVoiceTurn(text: string): boolean {
  const pending = voiceCallBus.pending
  if (!pending || pending.text !== text) return false
  voiceCallBus.pending = null
  return true
}

/** The call is over (or the turn failed before it was sent): nothing stays armed. */
export function disarmVoiceTurn(): void {
  voiceCallBus.pending = null
}

/** mode "voice" and the cap "voice1" (after any caps already there, once) on a user_message's data. */
export function addVoiceCallFields(data: Record<string, unknown>, text: string): Record<string, unknown> {
  if (!takeVoiceTurn(text)) return data
  data.mode = VOICE_TURN_MODE
  const existing = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter(cap => typeof cap === 'string') as string[] : []
  data.client_caps = existing.includes(VOICE_CAP) ? existing : [...existing, VOICE_CAP]
  return data
}

// ---------------------------------------------------------------------------
// Reading Director's frames
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const cleanText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)
const frameType = (frame: unknown): string => (isRecord(frame) && typeof frame.type === 'string' ? frame.type : '')
const framePayload = (frame: unknown): Record<string, unknown> => (isRecord(frame) && isRecord(frame.payload) ? frame.payload : {})

/** What Director's frames say the character should be doing. `idle` clears a held state. */
export type DirectorSignal =
  | { kind: 'idle' }
  | { kind: 'thinking' }
  | { kind: 'working' }
  | { kind: 'reporting'; decline: boolean }
  | { kind: 'pleased'; big: boolean }
  | { kind: 'concerned' }
  | { kind: 'waiting' }
  | { kind: 'paused' }
  | { kind: 'reading' }

/** The values payload.companion_state carries (P4-18: thinking, working, reporting, pleased, concerned, waiting; "listening" is client-only and never sent). The extra names are tolerated, never required. Anything else is ignored, never guessed at. */
export const COMPANION_STATE_HINTS: readonly string[] = ['thinking', 'working', 'reporting', 'pleased', 'concerned', 'waiting', 'idle', 'celebrating', 'sorry', 'paused', 'reading']

/** "I can't ...": an honest decline reads as sorry (a shrug), not as an error. */
export function isDeclineText(text: string | null | undefined): boolean {
  return typeof text === 'string' && /^\W*(?:sorry\b|i\s+(?:can['\u2019]?t|cannot|can\s+not|couldn['\u2019]?t|could\s+not|am\s+(?:not\s+able|unable))\b|i['\u2019]m\s+(?:not\s+able|unable)\b)/i.test(text.trim())
}

function signalFromHint(hint: unknown): DirectorSignal | null {
  if (typeof hint !== 'string' || !COMPANION_STATE_HINTS.includes(hint)) return null
  switch (hint) {
    case 'idle': return { kind: 'idle' }
    case 'thinking': return { kind: 'thinking' }
    case 'working': return { kind: 'working' }
    case 'reporting': return { kind: 'reporting', decline: false }
    case 'pleased': return { kind: 'pleased', big: false }
    case 'celebrating': return { kind: 'pleased', big: true }
    case 'concerned': return { kind: 'concerned' }
    case 'sorry': return { kind: 'reporting', decline: true }
    case 'waiting': return { kind: 'waiting' }
    case 'paused': return { kind: 'paused' }
    default: return { kind: 'reading' }
  }
}

/**
 * Garud's table, with the frames DIRECTOR-2 confirmed carry each state (the Director's own companion_state says the same, and wins when it is there):
 *   status_update "thinking" -> thinking          (the user's message was taken, no reply text yet)
 *   build_phase building ... / build_event started|progress / slide_progress / status_update "generating" -> working
 *   chat_message -> reporting (an honest "I can't ..." is sorry); an ephemeral progress bubble is not a report
 *   slide_built -> pleased; build_phase complete -> pleased, big
 *   slide_failed, build_event error, status_update error, build_phase error -> concerned
 *   action_request -> waiting; build_phase paused / stopped -> paused
 * The hint is refined by what only the frame knows: a chat_message hinted "reporting" whose text declines is sorry; a build_phase complete hinted "pleased" is the big celebration; a build_phase paused hinted
 * "waiting" is the paused pose (Garud's hold), not the inviting one. A frame that says nothing about the character returns null.
 */
export function signalFromFrame(frame: unknown): DirectorSignal | null {
  const type = frameType(frame)
  const payload = framePayload(frame)
  const hinted = signalFromHint(payload.companion_state)
  if (hinted) {
    if (hinted.kind === 'reporting' && type === 'chat_message') return { kind: 'reporting', decline: isDeclineText(cleanText(payload.text)) }
    if (hinted.kind === 'pleased' && type === 'build_phase' && payload.phase === 'complete') return { kind: 'pleased', big: true }
    if (hinted.kind === 'waiting' && type === 'build_phase' && payload.phase === 'paused') return { kind: 'paused' }
    return hinted
  }
  switch (type) {
    case 'status_update': {
      const status = payload.status
      if (status === 'thinking') return { kind: 'thinking' }
      if (status === 'generating') return { kind: 'working' }
      if (status === 'error') return { kind: 'concerned' }
      if (status === 'idle') return { kind: 'idle' }
      return null
    }
    case 'build_phase': {
      const phase = payload.phase
      if (phase === 'planning' || phase === 'strawman' || phase === 'building' || phase === 'qa' || phase === 'finalizing') return { kind: 'working' }
      if (phase === 'complete') return { kind: 'pleased', big: true }
      if (phase === 'paused' || phase === 'stopped') return { kind: 'paused' }
      if (phase === 'error') return { kind: 'concerned' }
      return null
    }
    case 'build_event': {
      const status = payload.status
      if (status === 'error') return { kind: 'concerned' }
      if (status === 'started' || status === 'progress' || status === undefined) return { kind: 'working' }
      return null
    }
    case 'slide_progress': return { kind: 'working' }
    case 'slide_built': return { kind: 'pleased', big: false }
    case 'slide_failed': return { kind: 'concerned' }
    case 'action_request': return { kind: 'waiting' }
    case 'chat_message': {
      if (payload.ephemeral === true) return null
      return { kind: 'reporting', decline: isDeclineText(cleanText(payload.text)) }
    }
    default: return null
  }
}

/** The words a frame says about what Director is doing (build_event of the whole deck, a build_phase label, a status_update, a slide_progress): shown under the disc and, in a long wait, spoken. A slide-scoped build_event is not the deck's story. */
export function progressTextFromFrame(frame: unknown): string | null {
  const type = frameType(frame)
  const payload = framePayload(frame)
  if (type === 'build_event') return payload.scope === 'slide' ? null : cleanText(payload.text)
  if (type === 'build_phase') return cleanText(payload.label)
  if (type === 'status_update') return payload.status === 'thinking' ? null : cleanText(payload.text)
  if (type === 'slide_progress') return cleanText(payload.text)
  return null
}

/**
 * What the Director says aloud, from payload.spoken, and only that (P4-18): on a chat_message (a reply: two sentences at most, about 240 characters, the closing question always in), on an action_request (a card or
 * the clarifying questions, all of them, about 240 characters) and, for a progress line, on a status_update, a build_phase or a deck-scope build_event (about 120 characters, never filler, never a repeat). A line over its
 * cap is a mistake on the Director's side, not something to read aloud, so it is not said. A frame with no spoken line has nothing to say, and nothing is made up from its text.
 */
export const MAX_SPOKEN_CHARS = 300
export const MAX_SPOKEN_PROGRESS_CHARS = 160
export function spokenLineFromFrame(frame: unknown): string | null {
  const type = frameType(frame)
  const payload = framePayload(frame)
  const long = type === 'chat_message' || type === 'action_request'
  if (!long && type !== 'status_update' && type !== 'build_phase' && !(type === 'build_event' && payload.scope === 'deck')) return null
  const line = cleanText(payload.spoken)
  return line && line.length <= (long ? MAX_SPOKEN_CHARS : MAX_SPOKEN_PROGRESS_CHARS) ? line : null
}

/** A spoken line on a progress frame (not a reply or a card): the client decides which are worth saying, and when (Garud's rules, the controller's). */
export const isProgressSpoken = (frame: unknown): boolean => frameType(frame) !== 'chat_message' && frameType(frame) !== 'action_request' && spokenLineFromFrame(frame) !== null

/** The chat text of a chat_message (what the caption falls back to), or null. */
export function replyTextFromFrame(frame: unknown): string | null {
  return frameType(frame) === 'chat_message' ? cleanText(framePayload(frame).text) : null
}

// ---------------------------------------------------------------------------
// A spoken answer to a card (PROVISIONAL, P4-18: a "yes" to the plan goes as the card's own text and its action_value, with mode "voice")
// ---------------------------------------------------------------------------

/** One button of an action_request, as Director sends it. */
export interface VoiceAction { label: string; value: string; primary: boolean; requires_input: boolean }

/** The buttons of an action_request frame (a card with none is a question for the chat), or null. */
export function actionsFromFrame(frame: unknown): VoiceAction[] | null {
  if (frameType(frame) !== 'action_request') return null
  const raw = framePayload(frame).actions
  if (!Array.isArray(raw)) return null
  const actions = raw.filter(isRecord).filter(a => typeof a.label === 'string' && a.label.trim() && typeof a.value === 'string' && a.value)
    .map(a => ({ label: (a.label as string).trim(), value: a.value as string, primary: a.primary === true, requires_input: a.requires_input === true }))
  return actions.length > 0 ? actions : null
}

/** Director has moved on (a new turn is being worked): a card that was open is answered, or over. Frames that only report or end a build do not close it (the "what next?" card arrives beside build_phase complete). */
export function closesOpenAction(frame: unknown): boolean {
  const type = frameType(frame)
  const payload = framePayload(frame)
  if (type === 'status_update') return payload.status === 'thinking' || payload.status === 'generating'
  if (type === 'build_phase') return payload.phase === 'planning' || payload.phase === 'strawman' || payload.phase === 'building' || payload.phase === 'qa' || payload.phase === 'finalizing'
  return false
}

const sayNorm = (text: string): string => text.toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(please|thanks|thank you)\b/g, ' ').replace(/\s+/g, ' ').trim()
const YES_WORDS: readonly string[] = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'go ahead', 'do it', 'go for it', 'lets go', 'looks good', 'looks great', 'looks perfect', 'sounds good', 'sounds great', 'that works', 'thats good', 'perfect', 'great', 'approve', 'accept', 'confirm', 'lets build it', 'build it', 'yes lets build it', 'yes go ahead', 'yes do it', 'yes sure', 'yes thats right']
const NO_WORDS: readonly string[] = ['no', 'nope', 'nah', 'not yet', 'not quite', 'change it', 'make changes', 'make some changes', 'i want changes', 'i want to make changes', 'id like changes', 'id like to make changes', 'no change it', 'no make changes']

/**
 * Which button of an open card the user said, or null (then the words go as an ordinary voice message). Only a clear match counts, the whole transcript and nothing more:
 *   the label, as it reads (case, punctuation and "please" aside), when exactly one button has it;
 *   on a two-button card with one primary, a plain yes (or "go ahead", "looks good" ...) is the primary button and a plain no (or "change it") is the other.
 * A button that asks for typed input is never picked by voice, "yes, but make it shorter" is a message, not a click, and a card with no buttons is never answered by a button.
 */
export function matchSpokenAnswer(transcript: string, actions: readonly VoiceAction[] | null | undefined): VoiceAction | null {
  if (!actions || actions.length === 0 || typeof transcript !== 'string') return null
  const said = sayNorm(transcript)
  if (!said) return null
  const byLabel = actions.filter(action => sayNorm(action.label) === said)
  if (byLabel.length > 1) return null
  if (byLabel.length === 1) return byLabel[0]!.requires_input ? null : byLabel[0]!
  const primary = actions.filter(action => action.primary), others = actions.filter(action => !action.primary)
  if (primary.length !== 1 || others.length !== 1) return null
  if (YES_WORDS.includes(said)) return primary[0]!.requires_input ? null : primary[0]!
  if (NO_WORDS.includes(said)) return others[0]!.requires_input ? null : others[0]!
  return null
}

// ---------------------------------------------------------------------------
// The character's scene
// ---------------------------------------------------------------------------

export type CallPhase = 'idle' | 'listening' | 'thinking' | 'speaking'
export type CompanionScene = 'idle' | 'listening' | 'thinking' | 'speaking' | 'working' | 'reporting' | 'pleased' | 'celebrating' | 'concerned' | 'sorry' | 'waiting' | 'paused' | 'reading'

export const SCENES: readonly CompanionScene[] = ['idle', 'listening', 'thinking', 'speaking', 'working', 'reporting', 'pleased', 'celebrating', 'concerned', 'sorry', 'waiting', 'paused', 'reading']

/** How long each one-shot beat is held before the character goes back to what it was doing (ms). */
export const BEAT_MS: Readonly<Record<'reporting' | 'pleased' | 'celebrating' | 'concerned' | 'sorry', number>> = { reporting: 2500, pleased: 2200, celebrating: 3800, concerned: 4500, sorry: 3500 }
/** A reply's first line is held this long after its text arrives, so the character's gesture (present, sorry, concerned) is seen before it speaks (a real voice takes about as long to arrive). */
export const REPLY_LEAD_MS = 500
/** A small "pleased" (one slide built) at most this often. */
export const PLEASED_EVERY_MS = 20000

export interface DirectorTrack {
  /** What Director is doing now, until a frame says otherwise. */
  background: 'none' | 'thinking' | 'working' | 'waiting' | 'paused' | 'reading'
  beat: { scene: 'reporting' | 'pleased' | 'celebrating' | 'concerned' | 'sorry'; until: number } | null
  lastPleasedAt: number | null
  /** How many big celebrations so far (every third one may dance, never twice within a minute). */
  celebrations: number
  lastDanceAt: number | null
  /** Whether the beat that is playing (or last played) is a celebration that dances. */
  dance: boolean
}

export const initialDirectorTrack = (): DirectorTrack => ({ background: 'none', beat: null, lastPleasedAt: null, celebrations: 0, lastDanceAt: null, dance: false })

/** Every third big celebration may dance (Garud's "sometimes a dance"), and never within a minute of the last one. */
export const DANCE_EVERY = 3
export const DANCE_COOLDOWN_MS = 60000

/** Which beat wins when two are at once: a failure is not covered by the report that explains it, a decline not by a plain report. */
export const BEAT_RANK: Readonly<Record<'reporting' | 'pleased' | 'celebrating' | 'sorry' | 'concerned', number>> = { reporting: 0, pleased: 1, celebrating: 2, sorry: 3, concerned: 4 }
type BeatScene = 'reporting' | 'pleased' | 'celebrating' | 'sorry' | 'concerned'
const outranks = (held: DirectorTrack['beat'], next: BeatScene): boolean => !!held && BEAT_RANK[held.scene] > BEAT_RANK[next]

/** Fold one signal into the track. Pure: `now` is a millisecond clock the caller owns. A beat still playing is kept when the new one ranks below it (BEAT_RANK). */
export function applyDirectorSignal(track: DirectorTrack, signal: DirectorSignal, now: number): DirectorTrack {
  const expired = track.beat && now >= track.beat.until ? { ...track, beat: null } : track
  switch (signal.kind) {
    case 'idle': return { ...expired, background: 'none' }
    case 'thinking': return { ...expired, background: 'thinking' }
    case 'working': return { ...expired, background: 'working' }
    case 'waiting': return { ...expired, background: 'waiting' }
    case 'paused': return { ...expired, background: 'paused' }
    case 'reading': return { ...expired, background: 'reading' }
    case 'reporting': {
      const scene = signal.decline ? 'sorry' : 'reporting'
      // The reply ends the thinking; a build that is running stays what the character is doing once the beat is over.
      const background = expired.background === 'thinking' ? 'none' : expired.background
      if (outranks(expired.beat, scene)) return { ...expired, background }
      return { ...expired, background, beat: { scene, until: now + BEAT_MS[scene] }, dance: false }
    }
    case 'pleased': {
      if (signal.big) {
        const celebrations = expired.celebrations + 1
        const dance = (celebrations - 1) % DANCE_EVERY === DANCE_EVERY - 1 && (expired.lastDanceAt === null || now - expired.lastDanceAt >= DANCE_COOLDOWN_MS)
        const held = outranks(expired.beat, 'celebrating')
        return { ...expired, background: 'none', celebrations, lastDanceAt: dance ? now : expired.lastDanceAt, lastPleasedAt: now, ...(held ? {} : { dance, beat: { scene: 'celebrating' as const, until: now + BEAT_MS.celebrating + (dance ? 2000 : 0) } }) }
      }
      if (expired.lastPleasedAt !== null && now - expired.lastPleasedAt < PLEASED_EVERY_MS) return expired
      if (outranks(expired.beat, 'pleased')) return { ...expired, lastPleasedAt: now }
      return { ...expired, lastPleasedAt: now, dance: false, beat: { scene: 'pleased', until: now + BEAT_MS.pleased } }
    }
    case 'concerned': return { ...expired, background: expired.background === 'thinking' ? 'none' : expired.background, beat: { scene: 'concerned', until: now + BEAT_MS.concerned }, dance: false }
  }
}

/** A beat that came while the Director was speaking was hidden by the speech: when the speech ends it gets its full time (a "reporting" beat does not: the report was just spoken). */
export function rearmBeat(track: DirectorTrack, now: number): DirectorTrack {
  const beat = track.beat
  if (!beat || beat.scene === 'reporting') return track
  return { ...track, beat: { scene: beat.scene, until: now + BEAT_MS[beat.scene] } }
}

/** What to draw now. The call phase wins (talking and listening are the user's and Director's turn), then a beat that is still playing, then what Director is doing. */
export function companionScene(input: { phase: CallPhase; speakingNow?: boolean; track: DirectorTrack; now: number }): CompanionScene {
  if (input.phase === 'listening') return 'listening'
  if (input.phase === 'speaking' || input.speakingNow) return 'speaking'
  if (input.phase === 'thinking') return 'thinking'
  const beat = input.track.beat
  if (beat && input.now < beat.until) return beat.scene
  switch (input.track.background) {
    case 'thinking': return 'thinking'
    case 'working': return 'working'
    case 'waiting': return 'waiting'
    case 'paused': return 'paused'
    case 'reading': return 'reading'
    default: return 'idle'
  }
}

/** The state chip: the call's four words. A scene that is not the call's own (working, waiting ...) reads as the user's turn: the user may talk while the Director works. */
export type ChipLabel = 'Your turn' | 'Listening' | 'Thinking' | 'Speaking'
export function chipLabel(scene: CompanionScene): ChipLabel {
  if (scene === 'listening') return 'Listening'
  if (scene === 'thinking') return 'Thinking'
  if (scene === 'speaking') return 'Speaking'
  return 'Your turn'
}

// ---------------------------------------------------------------------------
// Scenes -> clips (Garud's table)
// ---------------------------------------------------------------------------

export interface ClipLike { frames: readonly string[]; fps: number; loop?: readonly [number, number]; hold?: number }
export type StepMode = 'once' | 'loop' | 'hold' | 'talk'
export interface ClipStep { clip: string; mode: StepMode }
export interface ScenePlan {
  /** In order; the last step is where the character rests. */
  steps: readonly ClipStep[]
  /** A short clip played now and then over the resting step, [min, max] ms apart. `reverse` plays it backwards (a glance up is look_down reversed). */
  accent: { clip: string; reverse: boolean; everyMs: readonly [number, number] } | null
  /** The eyes close now and then (the blink clip) while the face looks straight at you. */
  blink: boolean
  /** The still for reduced motion: this clip, at its hold frame (or its last, or its first for a loop). */
  still: { clip: string; at: 'first' | 'hold' | 'last' }
}

/** While it speaks, now and then a small emphasis (the pack's `emphasis`; a pack without it nods): the mouth stops for the moment it takes. */
const talkPlan: ScenePlan = { steps: [{ clip: 'talk_neutral', mode: 'talk' }], accent: { clip: 'emphasis', reverse: false, everyMs: [7000, 11000] }, blink: false, still: { clip: 'talk_neutral', at: 'first' } }

/** Garud's "Director states -> clips" table. `dance` adds the dance to a celebration (it falls back to nothing when a pack has none). */
export function scenePlan(scene: CompanionScene, opts: { dance?: boolean } = {}): ScenePlan {
  switch (scene) {
    case 'idle': return { steps: [{ clip: 'idle_breathe', mode: 'loop' }], accent: null, blink: true, still: { clip: 'idle_breathe', at: 'first' } }
    case 'listening': return { steps: [{ clip: 'lean_in', mode: 'hold' }], accent: { clip: 'nod', reverse: false, everyMs: [3500, 5500] }, blink: false, still: { clip: 'lean_in', at: 'hold' } }
    case 'thinking': return { steps: [{ clip: 'expr_thinking_front', mode: 'hold' }], accent: null, blink: false, still: { clip: 'expr_thinking_front', at: 'hold' } }
    case 'speaking': return talkPlan
    case 'working': return { steps: [{ clip: 'work_loop', mode: 'loop' }], accent: { clip: 'look_down', reverse: true, everyMs: [8000, 12000] }, blink: true, still: { clip: 'work_loop', at: 'first' } }
    case 'reporting': return { steps: [{ clip: 'present', mode: 'once' }, { clip: 'idle_breathe', mode: 'loop' }], accent: null, blink: false, still: { clip: 'present', at: 'hold' } }
    case 'pleased': return { steps: [{ clip: 'expr_happy_front', mode: 'hold' }], accent: null, blink: false, still: { clip: 'expr_happy_front', at: 'hold' } }
    case 'celebrating': return {
      steps: [{ clip: 'expr_happy_front', mode: 'once' }, { clip: 'wave_both', mode: 'once' }, ...(opts.dance ? [{ clip: 'dance_bounce', mode: 'once' as const }] : []), { clip: 'expr_happy_front', mode: 'hold' }],
      accent: null, blink: false, still: { clip: 'expr_happy_front', at: 'hold' },
    }
    case 'concerned': return { steps: [{ clip: 'expr_concerned_front', mode: 'hold' }], accent: null, blink: false, still: { clip: 'expr_concerned_front', at: 'hold' } }
    case 'sorry': return { steps: [{ clip: 'expr_sorry_front', mode: 'once' }, { clip: 'shrug', mode: 'once' }, { clip: 'expr_sorry_front', mode: 'hold' }], accent: null, blink: false, still: { clip: 'expr_sorry_front', at: 'hold' } }
    case 'waiting': return { steps: [{ clip: 'invite', mode: 'once' }, { clip: 'lean_in', mode: 'hold' }], accent: null, blink: true, still: { clip: 'invite', at: 'hold' } }
    case 'paused': return { steps: [{ clip: 'hold', mode: 'hold' }], accent: null, blink: true, still: { clip: 'hold', at: 'hold' } }
    case 'reading': return { steps: [{ clip: 'look_down', mode: 'hold' }], accent: null, blink: false, still: { clip: 'look_down', at: 'hold' } }
  }
}

/** Every clip a scene may ask for (the player fetches these before it needs them), the blink and the accent included. */
export function clipsForScene(scene: CompanionScene): string[] {
  const plan = scenePlan(scene, { dance: scene === 'celebrating' })
  const names = plan.steps.map(step => step.clip)
  if (plan.accent) names.push(plan.accent.clip)
  if (plan.blink) names.push('blink')
  return [...new Set(names)]
}

export const clipDurationSec = (clip: ClipLike): number => (clip.fps > 0 ? clip.frames.length / clip.fps : 0)

/**
 * A pack may keep its companion clips (lean_in, work_loop, invite, hold, point_*, emphasis, shrug, thank_you ...) in a second catalog, motion/companion.json (Bob does; Felix has all 62 clips in the one manifest).
 * The base is loaded first and the companion catalog is merged in only when the base lacks `lean_in`: the base's clips and frames win, the catalog adds the ones the base does not have. The sum of the two
 * over-counts the bytes (they share their frames), and Garud states the combined set is under 8 MiB, so the combined size is capped at the pack's budget. Pure; a catalog that is not an object leaves the base alone.
 */
export interface RawCatalog { totalBytes?: number; packBudgetMiB?: number; uniqueFrames?: number; frames?: Record<string, unknown>; clips?: Record<string, unknown> }
/** Reads one manifest (and, when the base lacks the companion clips, merges companion.json from beside it). `fetchJson` and `parse` are the caller's (the player's fetch and the core's parser), so this stays pure and tested: a catalog that cannot be read, or a merged set the parser refuses, leaves the base; the base itself failing fails. */
export async function loadCatalog<T>(url: string, fetchJson: (url: string) => Promise<unknown>, parse: (raw: unknown) => T): Promise<T> {
  const raw = (await fetchJson(url)) as RawCatalog
  if (needsCompanionCatalog(raw)) {
    try {
      return parse(mergeCompanionCatalog(raw, (await fetchJson(url.replace(/[^/]*$/, 'companion.json'))) as RawCatalog))
    } catch { /* the base alone */ }
  }
  return parse(raw)
}
export const needsCompanionCatalog = (raw: RawCatalog | null | undefined): boolean => !!raw && typeof raw === 'object' && !!raw.clips && !raw.clips.lean_in
export function mergeCompanionCatalog<T extends RawCatalog>(base: T, companion: RawCatalog | null | undefined): T {
  if (!companion || typeof companion !== 'object' || !companion.frames || !companion.clips || !base.frames || !base.clips) return base
  const frames = { ...companion.frames, ...base.frames }
  const clips = { ...companion.clips, ...base.clips }
  const budget = Number.isInteger(base.packBudgetMiB) ? Math.min(8, Math.max(6, base.packBudgetMiB as number)) : 8
  const bytes = Math.min(budget * 1024 * 1024, (base.totalBytes ?? 0) + (companion.totalBytes ?? 0))
  return { ...base, frames, clips, uniqueFrames: Object.keys(frames).length, totalBytes: bytes, packBudgetMiB: budget }
}

// ---------------------------------------------------------------------------
// A pack with a layered (v2) face: the compatibility view it is drawn in today, and the pack's catalogs
// ---------------------------------------------------------------------------

/**
 * Garud's v2 packs (Maya) carry the locked `face` contract inline in the manifest: an object (angles, pieces, patch, heads, recipes) that draws the mouth, eyes and brows as patches on a held body. A v1 pack's `face` is a
 * pointer to its Face catalog ({ manifest, totalBytes }), the only form the core's v1 parser knows. It refuses the inline object ("Invalid bird Face pack reference"); everything else in the manifest is a plain v1 catalog
 * (the body poses, the 9 talk slots, the blink, 61 clips), which is what a v1 player has always drawn: Garud's rule is that v2 is an additive `face` section and "turning it off plays the v1 pack".
 */
export function isLayeredFace(face: unknown): face is Record<string, unknown> {
  if (!face || typeof face !== 'object' || Array.isArray(face)) return false
  const section = face as { manifest?: unknown; pieces?: unknown }
  return typeof section.manifest !== 'string' && !!section.pieces && typeof section.pieces === 'object'
}
/**
 * THE COMPATIBILITY VIEW (pure): a manifest with a layered face is read as its v1 catalog (the same object without its `face` section), and the section is kept whole beside it for the v2 renderer, which is not here yet (the
 * seam is `layeredPainterFor` in components/builder/voice-call/companion-player.tsx). Any other manifest, including a broken one, is handed through untouched for the core's parser to accept or refuse.
 */
export function compatCatalog(raw: unknown): { catalog: unknown; layered: Record<string, unknown> | null } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { catalog: raw, layered: null }
  const { face, ...rest } = raw as Record<string, unknown>
  return isLayeredFace(face) ? { catalog: rest, layered: face } : { catalog: raw, layered: null }
}
/** The pointer a v1 pack's manifest holds to its Face catalog (a path beside the manifest), once the parser has accepted the manifest; null for a pack with no Face pointer. */
function faceCatalogPointer(raw: unknown): string | null {
  const face = raw && typeof raw === 'object' ? (raw as { face?: { manifest?: unknown } | null }).face : null
  return face && typeof face.manifest === 'string' ? face.manifest : null
}

/** One catalog of a pack, parsed: the manifest, the layered face section when it has one (kept for the v2 renderer, never drawn today) and the folder its frame files are in. */
export interface PackCatalog<T> { manifest: T; layered: Record<string, unknown> | null; base: string }
/**
 * A pack's catalog for this framing, parsed by the core through the compatibility view. The whole character (`/companions/<pack>/motion/manifest.json`) always; for the audio disc the Face catalog when the pack has one and it
 * loads: a v1 pack points at it from its manifest (`motion/face/manifest.json`), a v2 pack keeps its native Face catalog at the pack's root (`face/manifest.json`, self-contained, picked explicitly: the two are never combined).
 * A Face catalog that is missing or refused leaves the whole character, cropped. null when the whole character cannot be read or is refused: the caller draws the pack's portrait instead. Never throws. Pure: `fetchJson` and `parse` are the caller's.
 */
export async function loadCompanionPack<T>(pack: string, framing: CompanionFraming, fetchJson: (url: string) => Promise<unknown>, parse: (raw: unknown) => T): Promise<PackCatalog<T> | null> {
  const root = `/companions/${pack}/motion/`
  const read = (url: string) => loadCatalog(url, fetchJson, raw => { const view = compatCatalog(raw); return { manifest: parse(view.catalog), layered: view.layered, pointer: faceCatalogPointer(view.catalog) } })
  try {
    const main = await read(`${root}manifest.json`)
    if (framing === 'disc') {
      const url = main.layered ? `/companions/${pack}/face/manifest.json` : main.pointer ? `${root}${main.pointer}` : null
      if (url) {
        try {
          const face = await read(url)
          return { manifest: face.manifest, layered: face.layered, base: url.replace(/[^/]*$/, '') }
        } catch { /* the Face pack is optional: the whole character is cropped instead */ }
      }
    }
    return { manifest: main.manifest, layered: main.layered, base: root }
  } catch {
    return null
  }
}
/** The pack's portrait, the still the call shows when its catalog cannot be used (Garud's bird layout, 512 px, a head on a transparent ground). */
export const portraitUrl = (pack: string): string => `/companions/${pack}/portrait-512.webp`

/** The frame of one step `elapsed` seconds in: once runs to its last frame, hold runs to the clip's hold frame (or its last) and stays, loop repeats the clip's loop range (or all of it). */
export function stepFrameIndex(clip: ClipLike, mode: 'once' | 'loop' | 'hold', elapsedSec: number): number {
  const last = Math.max(0, clip.frames.length - 1)
  const raw = Math.floor(Math.max(0, elapsedSec) * clip.fps + 1e-7)
  if (mode === 'loop') {
    const [from, to] = clip.loop && clip.loop[1] > clip.loop[0] ? clip.loop : [0, clip.frames.length]
    return raw < to ? Math.min(raw, last) : Math.min(last, from + ((raw - from) % (to - from)))
  }
  if (mode === 'hold') return Math.min(raw, clip.hold !== undefined ? Math.min(clip.hold, last) : last)
  return Math.min(raw, last)
}

export interface PlanPose { step: number; clip: string; mode: StepMode; index: number; elapsed: number; resting: boolean }
/** Where a plan is `elapsedSec` after the scene began. `clipOf` returns the pack's clip for a name (after fallbacks); a talk step has no frame index (the mouth picks it). */
export function planPoseAt(plan: ScenePlan, clipOf: (name: string) => ClipLike, elapsedSec: number): PlanPose {
  let left = Math.max(0, elapsedSec)
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]!
    const clip = clipOf(step.clip)
    const last = i === plan.steps.length - 1
    if (step.mode === 'once' && !last) {
      const duration = clipDurationSec(clip)
      if (left < duration) return { step: i, clip: step.clip, mode: 'once', index: stepFrameIndex(clip, 'once', left), elapsed: left, resting: false }
      left -= duration
      continue
    }
    const mode = step.mode === 'talk' ? 'loop' : step.mode === 'once' ? 'hold' : step.mode
    return { step: i, clip: step.clip, mode: step.mode, index: step.mode === 'talk' ? 0 : stepFrameIndex(clip, mode, left), elapsed: left, resting: true }
  }
  return { step: 0, clip: 'idle_breathe', mode: 'loop', index: 0, elapsed: 0, resting: true }
}

/** The reduced-motion still of a scene: the frame index inside the clip it names. */
export function stillFrameIndex(plan: ScenePlan, clip: ClipLike): number {
  const last = Math.max(0, clip.frames.length - 1)
  if (plan.still.at === 'first') return 0
  if (plan.still.at === 'hold') return Math.min(clip.hold !== undefined ? clip.hold : last, last)
  return last
}

/** Seconds until the next accent or blink, from a unit random number in [0, 1). */
export function nextDelayMs(range: readonly [number, number], unit: number): number {
  const u = Number.isFinite(unit) ? Math.min(0.999999, Math.max(0, unit)) : 0
  return Math.round(range[0] + u * (range[1] - range[0]))
}
export const BLINK_EVERY_MS: readonly [number, number] = [3000, 6000]

/** Which of the nine mouth shapes (closed, slight, ah, ee, oh, oo, fv, mbp, smile) a speech level asks for, with a syllable clock to vary the shape inside an opening (the core's rig does the same). */
export function mouthShapeIndex(level: number, timeSec: number, fps: number): number {
  const smooth = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0
  const syllable = Math.floor(Math.max(0, timeSec) * Math.max(1, fps))
  if (smooth < 0.025) return syllable % 11 === 0 ? 7 : syllable % 7 === 0 ? 8 : 0
  if (smooth < 0.15) return syllable % 3 === 0 ? 6 : 1
  if (smooth < 0.42) return [3, 4, 5][syllable % 3]!
  return [2, 4, 3][syllable % 3]!
}

// ---------------------------------------------------------------------------
// The recording as the router wants it (ROUTER-1's contract: STT runs server-side through the router's chat/completions with input_audio, base64 WAV)
// ---------------------------------------------------------------------------

/** What is sent for hearing: WAV, one channel, 16-bit, this many samples a second. The capture layer (the browser adapter) converts what the microphone gave; these three functions are the pure part of that. */
export const VOICE_WAV_RATE = 16000

/** Every channel of the recording averaged into one (samples may be any ArrayLike of numbers in -1..1). */
export function mixToMono(channels: readonly ArrayLike<number>[]): Float32Array {
  const length = channels.reduce((most, channel) => Math.max(most, channel.length), 0)
  const out = new Float32Array(length)
  if (channels.length === 0) return out
  for (const channel of channels) for (let i = 0; i < channel.length; i++) out[i]! += channel[i]!
  if (channels.length > 1) for (let i = 0; i < length; i++) out[i] = out[i]! / channels.length
  return out
}

/** Linear resampling from one rate to another (speech for hearing: no fancier filter is needed). The same rate returns the samples as they are. */
export function resampleLinear(samples: ArrayLike<number>, fromRate: number, toRate: number): Float32Array {
  if (!(fromRate > 0) || !(toRate > 0) || samples.length === 0) return new Float32Array(0)
  if (fromRate === toRate) return Float32Array.from(samples as ArrayLike<number>)
  const length = Math.max(1, Math.round(samples.length * toRate / fromRate))
  const out = new Float32Array(length)
  const ratio = fromRate / toRate
  for (let i = 0; i < length; i++) {
    const at = i * ratio
    const before = Math.floor(at), after = Math.min(samples.length - 1, before + 1)
    const fraction = at - before
    out[i] = samples[Math.min(before, samples.length - 1)]! * (1 - fraction) + samples[after]! * fraction
  }
  return out
}

/** A WAV file (RIFF, PCM, mono, 16-bit little-endian) of samples in -1..1; anything outside is clipped and a bad number is silence. */
export function encodeWavPcm16(samples: ArrayLike<number>, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const value = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i]!)) : 0
    view.setInt16(44 + i * 2, value < 0 ? Math.round(value * 32768) : Math.round(value * 32767), true)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// The pack's framing (where the face and the chest sit in a bird-format frame)
// ---------------------------------------------------------------------------

/** An audio call: the face disc, large and centred, with a level ring around it. */
export const AUDIO_DISC_PX = 176
export const AUDIO_DISC_PX_PHONE = 148
/** A phone, as the call lays out: 767 px and narrower. */
export const VOICE_PHONE_MEDIA = '(max-width: 767px)'
/** Hands and head stay inside this fraction of the frame (Garud's safe area), so a crop never cuts a gesture. */
export const SAFE_AREA = 0.9

export interface FramingManifest { size: { width: number; height: number }; bbox: { x: number; y: number; width: number; height: number }; variant?: string }
export interface FramingRect { sx: number; sy: number; sw: number; sh: number }

/** Garud's chest window for the video call, in a 768 x 768 motion frame (streams/companions-expansion/CANVAS.md): the full head and both hands, from mid-thigh up. Scaled to each pack's own `size`, never assumed. */
export const CHEST_WINDOW = { x: -16, y: 48, width: 800, height: 560 }
/** The frame size Garud's numbers are measured in. */
export const CHEST_WINDOW_FRAME = 768
/** How the video call frames the character: the chest close-up (the default) or the whole character (a toggle on the call screen). */
export type VideoFraming = 'chest' | 'full'
export type CompanionFraming = 'disc' | VideoFraming

/**
 * The rectangle of a frame to draw (it may reach past the frame's edges: what lies outside is transparent, never stretched in). A Face pack (variant "face") is drawn whole, at its own aspect, in the disc.
 * A full pack in the disc is the head and shoulders (the top 40% of the character, a square centred on it). The chest is Garud's chest window, scaled to the pack's size, moved up or widened (keeping its aspect) only when the
 * character's box would leave it, so the face and hands are never cut. Full length is the whole frame.
 */
export function framingRect(manifest: FramingManifest, framing: CompanionFraming, options: { tight?: boolean } = {}): FramingRect {
  const { size, bbox } = manifest
  if (manifest.variant === 'face' && framing === 'disc') return { sx: 0, sy: 0, sw: size.width, sh: size.height }
  const cx = bbox.x + bbox.width / 2
  if (framing === 'disc') {
    const side = Math.min(bbox.height * 0.4, size.width)
    return { sx: clamp(cx - side / 2, 0, size.width - side), sy: bbox.y, sw: side, sh: side }
  }
  if (framing === 'full') return { sx: 0, sy: 0, sw: size.width, sh: size.height }
  const unit = size.width / CHEST_WINDOW_FRAME
  let sx = CHEST_WINDOW.x * unit, sy = CHEST_WINDOW.y * unit, sw = CHEST_WINDOW.width * unit, sh = CHEST_WINDOW.height * unit
  const aspect = sw / sh
  if (bbox.y < sy) sy = bbox.y
  const left = Math.min(sx, bbox.x), right = Math.max(sx + sw, bbox.x + bbox.width)
  if (right - left > sw) { sw = right - left; sh = sw / aspect }
  sx = Math.min(Math.max(sx, bbox.x + bbox.width - sw), bbox.x)
  if (options.tight) {
    // The phone close-up (PK 6 Nov): the same rows, narrowed to the character's box plus a margin, so at the stage's width it is drawn larger. The box holds the full head and both hands in every frame, so nothing is cut.
    const pad = size.width * TIGHT_CHEST_PAD
    const left = Math.max(sx, bbox.x - pad), right = Math.min(sx + sw, bbox.x + bbox.width + pad)
    return { sx: left, sy, sw: right - left, sh }
  }
  return { sx, sy, sw, sh }
}
/** The margin either side of the character's box in the phone close-up, as a share of the frame's width. */
export const TIGHT_CHEST_PAD = 0.03

/** Where a framing rectangle lands on a canvas: ONE scale for x and y (contain), centred, letterboxed. `k` maps frame pixels to canvas pixels; a frame point (x, y) is at (ox + x * k, oy + y * k). `src` is the part of the rectangle inside the frame, `dst` where it is drawn. */
export interface DrawPlan { k: number; ox: number; oy: number; src: FramingRect; dst: { x: number; y: number; w: number; h: number } }
export function containPlan(rect: FramingRect, frame: { width: number; height: number }, canvasW: number, canvasH: number): DrawPlan {
  const k = Math.min(canvasW / rect.sw, canvasH / rect.sh)
  const ox = (canvasW - rect.sw * k) / 2 - rect.sx * k, oy = (canvasH - rect.sh * k) / 2 - rect.sy * k
  const x0 = Math.max(rect.sx, 0), y0 = Math.max(rect.sy, 0), x1 = Math.min(rect.sx + rect.sw, frame.width), y1 = Math.min(rect.sy + rect.sh, frame.height)
  const src = { sx: x0, sy: y0, sw: Math.max(0, x1 - x0), sh: Math.max(0, y1 - y0) }
  return { k, ox, oy, src, dst: { x: ox + x0 * k, y: oy + y0 * k, w: src.sw * k, h: src.sh * k } }
}

/** The audio disc (PK 6 Nov): ONE scale for x and y that COVERS the canvas, k = max(dw / sw, dh / sh), centred; what falls outside the disc is cut, nothing is stretched and no edge of the frame shows inside it. Same fields as containPlan. */
export function coverPlan(rect: FramingRect, frame: { width: number; height: number }, canvasW: number, canvasH: number): DrawPlan {
  const k = Math.max(canvasW / rect.sw, canvasH / rect.sh)
  const ox = (canvasW - rect.sw * k) / 2 - rect.sx * k, oy = (canvasH - rect.sh * k) / 2 - rect.sy * k
  const x0 = Math.max(rect.sx, 0), y0 = Math.max(rect.sy, 0), x1 = Math.min(rect.sx + rect.sw, frame.width), y1 = Math.min(rect.sy + rect.sh, frame.height)
  const src = { sx: x0, sy: y0, sw: Math.max(0, x1 - x0), sh: Math.max(0, y1 - y0) }
  return { k, ox, oy, src, dst: { x: ox + x0 * k, y: oy + y0 * k, w: k * src.sw, h: k * src.sh } }
}
/** The plan for a framing: the disc covers, a video framing is contained. */
export function framingPlan(framing: CompanionFraming, rect: FramingRect, frame: { width: number; height: number }, canvasW: number, canvasH: number): DrawPlan {
  return framing === 'disc' ? coverPlan(rect, frame, canvasW, canvasH) : containPlan(rect, frame, canvasW, canvasH)
}

/** The CSS box of the companion. The disc is a square of `size`. A video framing is as wide as its crop at `size` tall, but never wider than `maxWidth` (the stage): then it is the stage's width and shorter, keeping the crop's aspect. No pack read yet: a square. */
export function framedBox(framing: CompanionFraming, size: number, rect: FramingRect | null, maxWidth?: number): { width: number; height: number } {
  if (!rect || framing === 'disc') return { width: size, height: size }
  const aspect = rect.sw / rect.sh
  const cap = maxWidth && maxWidth > 0 ? maxWidth : Infinity
  const width = Math.min(size * aspect, cap)
  return { width: Math.round(width), height: Math.round(width / aspect) }
}
/** The CSS width of the companion (framedBox's, with no stage cap). */
export function framedWidth(framing: CompanionFraming, size: number, rect: FramingRect | null): number {
  return framedBox(framing, size, rect).width
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** One or two capitals for a disc with no pack (or a pack that failed to load): "bob" is "B", "deckster-owl" is "DO". */
export function initialsFor(name: string): string {
  const parts = name.split(/[^a-z0-9]+/i).filter(Boolean)
  const letters = parts.length > 1 ? parts.slice(0, 2).map(part => part[0]!) : [(parts[0] ?? 'D')[0]!]
  return letters.join('').toUpperCase()
}

// ---------------------------------------------------------------------------
// The controls and the words
// ---------------------------------------------------------------------------

export interface CallControls {
  /** Hold to talk (the button, or Space), or tap to latch. */
  talk: boolean
  /** Stop what Director is saying (and a turn that is waiting), which is also what talking over it does. */
  stop: boolean
  /** Mute the microphone: no talking, a recording in progress is dropped. */
  mute: boolean
  end: boolean
}

export function callControls(input: { active: boolean; starting: boolean; phase: CallPhase; speakingNow: boolean; connected: boolean; muted?: boolean }): CallControls {
  const live = input.active && !input.starting
  return { talk: live && input.connected && !input.muted, stop: live && (input.phase === 'speaking' || input.phase === 'thinking' || input.speakingNow), mute: live, end: live }
}

/** The two kinds of call: audio (a calm scene: the face, large, with a level ring) and video (the character's whole scene, its setting behind it). Both have the same controls and the same transcript. */
export type CallMode = 'audio' | 'video'
export const CALL_MODES: readonly CallMode[] = ['audio', 'video']
export const isCallMode = (value: unknown): value is CallMode => value === 'audio' || value === 'video'

/** What the composer's call buttons get (the page passes it down with the flag on, nothing with it off). The composer shows two buttons beside Send, one tap each: Audio and Video. While a call is on the composer is not shown at all. */
export interface VoiceCallComposerProps {
  /** A call is on (or starting): the composer is hidden. */
  active: boolean
  /** The microphone is being asked for. */
  busy: boolean
  disabled: boolean
  onStart: (mode: CallMode) => void
  /** Where the buttons sit (NEXT_PUBLIC_STUDIO_VOICE_CALL_BUTTONS). */
  buttons: CallButtonsVariant
}
/** Where the two call buttons sit (NEXT_PUBLIC_STUDIO_VOICE_CALL_BUTTONS, build-time, only with the call flag on): "a" beside Send, "b" a row of pills just under the chat box, "c" (the default, PK's pick) two compact pills on their own row right under Send, right-aligned. Anything else is "c". */
export type CallButtonsVariant = 'a' | 'b' | 'c'
export const DEFAULT_CALL_BUTTONS: CallButtonsVariant = 'c'
export function callButtonsVariantFrom(value: string | undefined): CallButtonsVariant {
  return value === 'a' || value === 'b' || value === 'c' ? value : DEFAULT_CALL_BUTTONS
}
export const STUDIO_VOICE_CALL_BUTTONS: CallButtonsVariant = callButtonsVariantFrom(process.env.NEXT_PUBLIC_STUDIO_VOICE_CALL_BUTTONS)
/** The short word on a pill. */
export const callButtonWord = (mode: CallMode): string => (mode === 'video' ? 'Video' : 'Call')
export function callButtonLabel(mode: CallMode): string {
  return mode === 'video' ? 'Start a video call' : 'Start an audio call'
}

/** Space talks while a call is on, unless the key belongs to what has focus: a text field, a select, an editable region, or a control that Space activates (a button, a link, a menu item, a tab, a checkbox ...) keeps its Space. The talk button is the exception: with focus on it, Space is what it is for. The call's other buttons (Stop, Mute, End, the transcript toggle) keep their Space. */
export interface SpaceTarget { tagName?: string; isContentEditable?: boolean; getAttribute?(name: string): string | null; closest?(selector: string): unknown }
const SPACE_ROLES = /^(button|link|menuitem|menuitemcheckbox|menuitemradio|tab|option|switch|checkbox|radio|combobox|slider|spinbutton|textbox|searchbox)$/
export function spaceBelongsToTarget(target: SpaceTarget | null | undefined): boolean {
  if (!target) return false
  if (isTypingTarget(target)) return true
  if (target.closest?.('.studio-voice-talk')) return false
  const tag = (target.tagName ?? '').toUpperCase()
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true
  const role = target.getAttribute?.('role')
  return typeof role === 'string' && SPACE_ROLES.test(role)
}

/** When a call ends the composer comes back, and its text box takes keyboard focus, but only if focus was lost with the call or never left the page: on the page itself (`body`, or nothing: the call's own controls unmount with the call, and the browser drops focus to the page), or still inside the call's own UI (the stage, the notice: `data-studio-voice-call`). Focus anywhere else (the sidebar, a menu, another field, a dialog) is the person's and stays where it is. `active` is document.activeElement when the call has ended. */
export interface FocusTarget { tagName?: string; closest?(selector: string): unknown }
export function callEndFocusGoesToComposer(active: FocusTarget | null | undefined): boolean {
  if (!active) return true
  const tag = (active.tagName ?? '').toUpperCase()
  if (tag === 'BODY' || tag === 'HTML') return true
  return !!active.closest?.('[data-studio-voice-call]')
}

/** Space talks, unless the user is typing: a text field, a select, a text area or an editable region keeps its Space. */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!target) return false
  const tag = (target.tagName ?? '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
}

/** The talk key: Space alone (no modifier, not a key repeat). */
export function isTalkKey(event: { code?: string; key?: string; repeat?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }): boolean {
  return (event.code === 'Space' || event.key === ' ') && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
}

export const TALK_HINT = 'Hold the button or Space to talk, or tap it to talk until you tap again'
export const TALK_LATCHED_HINT = 'Tap again to send'
/** The talk button's words: held, latched on by a tap, muted, or waiting. */
export function talkLabel(input: { holding: boolean; latched: boolean; muted: boolean }): string {
  if (input.muted) return 'Muted'
  if (input.latched) return 'Tap to send'
  if (input.holding) return 'Release to send'
  return 'Hold to talk'
}
export const MUTE_LABEL = 'Mute microphone'
export const UNMUTE_LABEL = 'Unmute microphone'
export const MUTED_HINT = 'Your microphone is muted'
/** A press shorter than this is a tap: it latches the microphone on until the next tap (a longer press is hold-to-talk, and letting go sends). */
export const TAP_TALK_MS = 300
/** A microphone latched on by a tap and then forgotten is sent (and closed) after this long. */
export const LATCH_MAX_MS = 60000

// ---------------------------------------------------------------------------
// The call's transcript and its scene
// ---------------------------------------------------------------------------

/** The live transcript of a call: what you said (as heard) and what the Director said (its spoken lines), oldest first. */
export interface TranscriptEntry { id: number; who: 'you' | 'director'; text: string }
export const TRANSCRIPT_MAX = 60
export const TRANSCRIPT_TITLE = 'Transcript'
export const TRANSCRIPT_HIDE_LABEL = 'Hide transcript'
export const TRANSCRIPT_SHOW_LABEL = 'Show transcript'
export const TRANSCRIPT_EMPTY = 'What you and the companion say will appear here.'
/** The name the companion goes by in the transcript: the pack's folder name in capitals ("bob" is "Bob", "deckster-owl" is "Deckster Owl"). */
export function companionName(pack: string): string {
  const words = String(pack).split(/[^a-z0-9]+/i).filter(Boolean)
  return words.length ? words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Companion'
}
/** Adds a line (trimmed; a blank one is not added; the same line twice in a row by the same speaker is not repeated), keeping the newest TRANSCRIPT_MAX. With `join` it carries on the same speaker's last entry instead. Pure: a new array, or the same one when nothing is added. */
export function appendTranscript(list: readonly TranscriptEntry[], who: TranscriptEntry['who'], text: string, max = TRANSCRIPT_MAX, join = false): readonly TranscriptEntry[] {
  const line = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
  if (!line) return list
  const last = list[list.length - 1]
  if (last && last.who === who && last.text === line) return list
  // join: the line carries on the same speaker's last entry (a reply spoken a sentence at a time reads as one message), keeping its id.
  if (join && last && last.who === who) return [...list.slice(0, -1), { ...last, text: `${last.text} ${line}` }]
  const next = [...list, { id: (last ? last.id : 0) + 1, who, text: line }]
  return next.length > max ? next.slice(next.length - max) : next
}

/** What the level ring and the mouth read: the raw level of the microphone or the speaker (a quiet voice is about 0.05 to 0.3) as 0..1, two decimals. */
export function ringLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0
  return Math.round(Math.min(1, level * 4) * 100) / 100
}

/** The transcript takes the bottom fifth of the call, the scene the rest (the character's scene is the canvas everything else overlays). */
export const TRANSCRIPT_SHARE = 0.2
export const SCENE_SHARE = 1 - TRANSCRIPT_SHARE

/** How tall the character is drawn in a video call: it fills the scene's share of the canvas, less room for the chip and the controls above it and the talk button under it. Clamped so a huge window or a tiny one stays sane. */
export function videoCharacterPx(canvasHeight: number): number {
  if (!Number.isFinite(canvasHeight) || canvasHeight <= 0) return 240
  return Math.round(Math.min(640, Math.max(160, canvasHeight * SCENE_SHARE * 0.78)))
}

/** The scene image a pack may carry: `scene` in its manifest (a path inside the pack's folder: letters, digits, dash, underscore, dot and slash, no "..", no leading slash, a web image), else scene.webp beside the manifest's folder. Anything else is the default. */
export const DEFAULT_SCENE_FILE = 'scene.webp'
export function sceneFileFrom(manifestScene: unknown): string {
  if (typeof manifestScene !== 'string') return DEFAULT_SCENE_FILE
  const path = manifestScene.trim()
  return /^[a-zA-Z0-9_][a-zA-Z0-9_./-]*\.(webp|png|jpg|jpeg)$/.test(path) && !path.split('/').includes('..') && !path.includes('//') ? path : DEFAULT_SCENE_FILE
}
export const sceneUrl = (pack: string, file: string): string => `/companions/${pack}/${file}`

/** Words for a speech (not microphone) problem. The microphone's own come from the core's describeMicError. */
export type SpeechProblem = 'not_connected' | 'limit' | 'failed' | 'too_short' | 'no_words' | 'not_sent' | 'no_answer'
export interface CallNotice { title: string; steps: string[] }
export function describeSpeechProblem(problem: SpeechProblem): CallNotice {
  switch (problem) {
    case 'not_connected': return { title: "Speech isn't connected yet", steps: ['You can still type to the Director as usual.'] }
    case 'limit': return { title: 'Voice is paused for now', steps: ['The voice limit has been reached. You can keep typing to the Director.'] }
    case 'failed': return { title: "Couldn't hear that", steps: ['Hold the button and try again.'] }
    case 'too_short': return { title: 'That was too short', steps: ['Hold the button the whole time you speak.'] }
    case 'no_words': return { title: "I didn't catch any words", steps: ['Hold the button and try again, a little closer to the microphone.'] }
    case 'not_sent': return { title: "That didn't reach the Director", steps: ['Check your connection, then try again.'] }
    case 'no_answer': return { title: "The Director hasn't answered yet", steps: ['It may still be working. You can wait, or try again.'] }
  }
}

/** The line under the disc while the Director works: "Building: <the words of the latest frame>" (cut at a word at 80 characters). */
export function progressCaption(text: string | null, scene: CompanionScene): string | null {
  if (!text || (scene !== 'working' && scene !== 'thinking')) return null
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line) return null
  if (line.length <= 80) return line
  const cut = line.slice(0, 80)
  const space = cut.lastIndexOf(' ')
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`
}
