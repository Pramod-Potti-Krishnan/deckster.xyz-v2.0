// CLEAN CHAT ORDER (FRONTEND-2, B31; E2E-2 live run c737ffe5, 27 Oct, Studio dev): two defects in the v3.1 chat clean thread, one flag.
//
//   1. A STALE WORKING LINE. The job card's one line is the newest deck event's text (lib/studio-chat-clean.ts chatCleanJobModel: `latestEventText || phaseLabel || title`).
//      Director mirrors its canned progress lines as deck-scope build_events, the last of them "Packaging your outline and picking a theme…" (websocket.py _build_progress_emitter,
//      idx 5, stage 'package'), and nothing replaces it: the reducer never retires deck events at a phase change, and a build's own events are slide-scope, which never reach deckEvents.
//      So that line stayed under "Shaping the outline", under "Waiting for you" at the outline card, and under "Building slides" after the build started.
//      Fix: an event is the card's line only inside the stretch of work it belongs to. Director's frame order from plan approval to the outline card (DIRECTOR-2, 27 Oct):
//        status_update → build_phase planning → progress chat_messages + deck build_events (the last "Packaging…") → slide_context → build_phase strawman → slide_update → outline chat line → action_request → token_usage.
//      No frame says "waiting", so the card closes the line on the three it can see: the phase change (strawman, the gate, and the build starting), the outline arriving (the narration's ghosts), and the approval card / ask arriving
//      (the transcript's newest action_request). At the outline gate itself (phase awaiting_user) no event line shows at all. After the build starts the card's own words stand in until the build sends a deck event of its own.
//      A pause, a resume, a stop and a Continue move inside the build's stretch and change nothing.
//
//   2. THE THREAD'S NOTES AT THE END. The record of stops, pauses, resumes and the user's directions (the "directions" bubble) is drawn by StudioChatCleanJob, which MessageList mounts after the LAST transcript row. So a marker or a bubble
//      from before Director's replies drew after them. Fix: each note is drawn at the moment it happened, between the transcript rows, by its time (the note's `at` and a row's time are both the browser's Date.now()).
//
// One flag, NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER, the string "true", default off, build-time, and only with NEXT_PUBLIC_STUDIO_CHAT_CLEAN on (the thread props exist only then). Off, nothing here runs and the chat is byte for byte what it was.
//
// IMPORT-FREE BY DESIGN (type-only imports are erased): scripts/test-studio-chat-clean-order.mjs transpiles this file into a bare function scope with a fake `process`.

import type { ChatCleanNote } from '@/lib/studio-chat-clean'

export function chatCleanOrderFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag, and chat clean itself (a literal process.env read each, so Next inlines them at build time). */
export const STUDIO_CHAT_CLEAN_ORDER_ENABLED = chatCleanOrderFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER) && chatCleanOrderFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN)

// ---------------------------------------------------------------------------
// 2. The notes between the rows
// ---------------------------------------------------------------------------

/** One transcript row as MessageList lists it (the user's turns and Director's frames): who, and when (NaN = unknown). */
export interface ChatCleanOrderRow {
  kind: 'user' | 'bot'
  time: number
}

/**
 * A row's time, the way MessageList sorts its list: a user turn by its timestamp (ms); a Director frame by its arrival stamp (clientTimestamp, ms) or else its frame timestamp (an ISO string, UTC when it
 * carries no zone); the groups MessageList builds (the combined outline card, the thinking stream) by the frame they start with. NaN when there is none.
 */
export function chatCleanRowTime(item: unknown): number {
  if (!item || typeof item !== 'object') return Number.NaN
  const row = item as { messageType?: unknown; type?: unknown; timestamp?: unknown; clientTimestamp?: unknown; slideUpdate?: unknown; messages?: unknown }
  if (row.messageType === 'user') return typeof row.timestamp === 'number' && Number.isFinite(row.timestamp) ? row.timestamp : Number.NaN
  if (typeof row.clientTimestamp === 'number' && Number.isFinite(row.clientTimestamp)) return row.clientTimestamp
  if (row.type === 'combined_strawman') return chatCleanRowTime(row.slideUpdate)
  if (row.type === 'thinking_stream' && Array.isArray(row.messages) && row.messages.length > 0) return chatCleanRowTime(row.messages[0])
  if (typeof row.timestamp === 'string' && row.timestamp.trim()) {
    const text = row.timestamp.trim()
    return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(text) ? text : `${text}Z`)
  }
  return Number.NaN
}

export interface ChatCleanNotePlan<N> {
  /** Notes drawn at the start of the Director row with this index (before it). */
  before: Record<number, N[]>
  /** Notes drawn at the end of the Director row with this index (after it). */
  after: Record<number, N[]>
  /** Notes with nothing after them: the thread's tail, as ever. */
  tail: N[]
}

/**
 * Where each note goes among the rows. A note sits after the last row that is not later than it. A Director row can hold notes at its start and at its end; a user row cannot, so a note that falls
 * before a user row goes to the end of the Director row before it, and one that falls between two user rows goes to the start of the next Director row (or the end of the last one before it). Notes that follow every row
 * stay in the tail. Within one place the notes keep their order. `hiddenId` is the stop note that the slim bar above the composer carries while the build is held (chatCleanHiddenNoteId): it is not drawn
 * between the rows; in the tail the thread's own rule leaves it out.
 */
export function chatCleanNotePlan<N extends { id: string; at: number }>(rows: readonly ChatCleanOrderRow[], notes: readonly N[], hiddenId: string | null = null): ChatCleanNotePlan<N> {
  const times: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const own = rows[i].time
    const before = i > 0 ? times[i - 1] : Number.NEGATIVE_INFINITY
    times.push(Number.isFinite(own) && own > before ? own : before) // unknown or earlier-than-its-neighbour times take the neighbour's: the rows are already in order
  }
  const plan: ChatCleanNotePlan<N> = { before: {}, after: {}, tail: [] }
  const nextDirector = (from: number): number => { for (let i = from; i < rows.length; i++) if (rows[i].kind === 'bot') return i; return -1 }
  const previousDirector = (from: number): number => { for (let i = from; i >= 0; i--) if (rows[i].kind === 'bot') return i; return -1 }
  for (const note of notes) {
    let later = rows.length
    for (let i = 0; i < rows.length; i++) if (times[i] > note.at) { later = i; break }
    let bucket: 'before' | 'after' | null = null
    let index = -1
    if (later < rows.length) {
      if (later > 0 && rows[later - 1].kind === 'bot') { bucket = 'after'; index = later - 1 }
      else if (rows[later].kind === 'bot') { bucket = 'before'; index = later }
      else {
        const next = nextDirector(later)
        if (next >= 0) { bucket = 'before'; index = next }
        else { const previous = previousDirector(later - 1); if (previous >= 0) { bucket = 'after'; index = previous } }
      }
    }
    if (bucket === null) { plan.tail.push(note); continue }
    if (note.id === hiddenId) continue
    const list = plan[bucket][index] ?? (plan[bucket][index] = [])
    list.push(note)
  }
  return plan
}

/** The newest note while the build is held and that note is the stop / pause one: the slim bar above the composer carries it, so the thread leaves it out (StudioChatCleanJob's rule, stated once more here for the notes between the rows). */
export function chatCleanHiddenNoteId(notes: readonly Pick<ChatCleanNote, 'id' | 'kind'>[], composerMode: string): string | null {
  if (composerMode !== 'held' && composerMode !== 'resuming') return null
  const last = notes.length ? notes[notes.length - 1] : null
  return last && (last.kind === 'stopped' || last.kind === 'paused') ? last.id : null
}

// ---------------------------------------------------------------------------
// 1. The working line
// ---------------------------------------------------------------------------

/** The id of the newest approval card / ask in the transcript (an action_request), or null: the moment Director's turn ended with a question for the user. */
export function chatCleanLastGateId(messages: readonly { type?: unknown; message_id?: unknown }[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message && message.type === 'action_request' && typeof message.message_id === 'string') return message.message_id
  }
  return null
}

/** What the card sees each time it draws: the build's phase and identity, the outline (the narration's ghosts: a new list per slide_update), the newest approval card, and the id of the newest deck event. */
export interface ChatCleanLineInput {
  phase: string
  buildId: string | null
  ghosts: unknown
  gate: string | null
  latestId: string | null
}

export interface ChatCleanLineState extends ChatCleanLineInput {
  /** The deck event that was the newest when the stretch of work it belonged to ended: never the card's line again. */
  retired: string | null
}

/** The phases of the outline stretch of work (before the build starts); every other phase belongs to the build's stretch (building, qa, finalizing, paused, stopped, error, complete). */
const OUTLINE_PHASES = ['idle', 'planning', 'strawman', 'awaiting_user']
const inOutline = (phase: string): boolean => OUTLINE_PHASES.includes(phase)

/**
 * One step. The work has moved on, and the event that was the newest at the last draw is retired, when: the build is a different one; the phase changed between the outline's stretch and the build's, or inside the
 * outline's (planning, strawman, the gate: DIRECTOR-2's build_phase strawman); or, while the outline's stretch is on, the outline arrived (a new ghosts list: slide_update) or an approval card / ask did. A pause, a resume, a stop and a
 * Continue are moves inside the build's stretch: they retire nothing, so the line a running build shows is the line it showed. An event that arrived in the same step as the change is new, so it stays. The first draw retires nothing.
 */
export function chatCleanLineStep(previous: ChatCleanLineState | null, input: ChatCleanLineInput): ChatCleanLineState {
  const moved = previous !== null && (
    previous.buildId !== input.buildId
    || (previous.phase !== input.phase && (inOutline(previous.phase) || inOutline(input.phase)))
    || (inOutline(input.phase) && (previous.gate !== input.gate || !Object.is(previous.ghosts, input.ghosts)))
  )
  const retired = previous === null ? null : moved ? previous.latestId : previous.retired
  return { ...input, retired }
}

/** Whether the newest deck event may be the card's line: not retired, and not at the outline gate (awaiting_user), where Director is waiting for the user and nothing is being worked on. */
export function chatCleanLineVisible(state: ChatCleanLineState): boolean {
  return state.latestId !== null && state.latestId !== state.retired && state.phase !== 'awaiting_user'
}
