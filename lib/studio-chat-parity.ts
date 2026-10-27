// CHAT-PARITY (FRONTEND-1, P3-1 A post-Thursday rows, Studio half; contract: deckster-workspace streams/frontend1/chat-parity-p3/CONTRACTS.md).
// Four flags, one per row group, each on only for the string "true", default off, build-time:
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES      rows 105/106/108: Director writes a slide's notes / script / references itself and sends
//                                             deck_mutation {mutation:"notes_updated"}; Studio advertises `notes1` and re-reads the Notes panel.
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES     rows 56-59, 61 (cap `themes1`)     — added by its own commit
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY   rows 62-64 (cap `identity1`)        — added by its own commit
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES  rows 65/66/67/72/76 (cap `templates1`) — added by its own commit
// With a group's flag on, Studio adds the group's cap to user_message.data.client_caps (beside mdc1, theme1, ...), takes Director's
// request frame out of band (never the reducer, the transcript or the cache), runs the SAME function the click path runs, and answers
// with the result frame. Director keeps the request's kind in its own pending table and closes the turn with a fixed line; Studio
// shows no line of its own. Every flag off: no cap is sent, the frames are unknown types (dropped at ingress, as before) and every
// file this change touches is byte for byte what it was (scripts/studio-chat-parity-strip.mjs).
//
// THE FRAME NAMES LIVE IN ONE PLACE (CHAT_PARITY_FRAMES): if DIRECTOR-2 prefers the existing element_directive_result route, only the
// two strings change (and the result's id key, CHAT_PARITY_RESULT_ID_KEY).
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-chat-parity.mjs transpiles this file into a bare function scope with a fake `process`.
// Every decision (which frame, which cap, is this request ours, what does the answer look like) is a pure function here; the hook and
// the page hold the state and do the I/O.

// ---------------------------------------------------------------------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------------------------------------------------------------------

/** Director -> Studio request frame type, Studio -> Director result frame type, and the correlation key the result carries. */
export const CHAT_PARITY_FRAMES = Object.freeze({
  request: 'studio_action',
  result: 'studio_action_result',
} as const)

/** The key under which the result frame's data carries the request's id (`directive_id` if the frames become element_directive_result). */
export const CHAT_PARITY_RESULT_ID_KEY = 'request_id'

export type ChatParityGroup = 'notes' | 'themes' | 'identity' | 'templates'
export type ChatParityStatus = 'done' | 'failed' | 'dismissed'
export type ChatParityErrorCode =
  | 'not_owner' | 'viewer_unavailable' | 'flag_off' | 'not_found' | 'locked' | 'invalid_args' | 'write_failed' | 'timeout' | 'unsupported'

// ---------------------------------------------------------------------------------------------------------------------------------------
// Flags (literal process.env reads so Next inlines them at build time)
// ---------------------------------------------------------------------------------------------------------------------------------------

export function chatParityFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

export const STUDIO_CHAT_PARITY_NOTES_ENABLED = chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES)

export interface ChatParityFlags {
  notes: boolean
  themes: boolean
  identity: boolean
  templates: boolean
}

/** The flags this build was made with. */
export const CHAT_PARITY_FLAGS: Readonly<ChatParityFlags> = Object.freeze({
  notes: STUDIO_CHAT_PARITY_NOTES_ENABLED,
  themes: false,
  identity: false,
  templates: false,
})

/** True when any group is on: the request frame is then taken out of band (a group that is off answers `failed` / `flag_off`). */
export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean)

// ---------------------------------------------------------------------------------------------------------------------------------------
// Capabilities (Studio -> Director, on every user_message)
// ---------------------------------------------------------------------------------------------------------------------------------------

/** The cap Director checks before it sends a group's request (exact, case-sensitive). `notes1` is Director's own name (set_speaker_notes). */
export const CHAT_PARITY_GROUP_CAPS: Readonly<Record<ChatParityGroup, string>> = Object.freeze({
  notes: 'notes1',
  themes: 'themes1',
  identity: 'identity1',
  templates: 'templates1',
})

/** The caps a build with these flags sends, in group order; empty when every flag is off (and then nothing is added to a send). */
export function chatParityCaps(flags: Readonly<ChatParityFlags>): string[] {
  return (['notes', 'themes', 'identity', 'templates'] as const).filter(group => flags[group] === true).map(group => CHAT_PARITY_GROUP_CAPS[group])
}

export const CHAT_PARITY_CAPS: readonly string[] = chatParityCaps(CHAT_PARITY_FLAGS)

/**
 * Adds the caps to a built `user_message.data`, in place: after whatever caps are there (mdc1, theme1, ...), each once. Called only when
 * `caps` is non-empty. A `client_caps` that is not an array of strings is replaced by the strings it holds plus ours.
 */
export function addChatParityCaps(data: Record<string, unknown>, caps: readonly string[] = CHAT_PARITY_CAPS): Record<string, unknown> {
  const existing = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter(cap => typeof cap === 'string') as string[] : []
  const next = [...existing]
  for (const cap of caps) if (!next.includes(cap)) next.push(cap)
  data.client_caps = next
  return data
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The request frame (Director -> Studio)
// ---------------------------------------------------------------------------------------------------------------------------------------

/** The actions each group runs. A request whose action is not in its group's list is answered `failed` / `unsupported`. */
export const CHAT_PARITY_ACTIONS: Readonly<Record<ChatParityGroup, readonly string[]>> = Object.freeze({
  notes: [], // Director writes notes itself (set_speaker_notes); Studio only reflects deck_mutation notes_updated
  themes: [],
  identity: [],
  templates: [],
})

export interface ChatParityRequest {
  requestId: string
  group: ChatParityGroup
  action: string
  presentationId: string | null
  args: Record<string, unknown>
  label: string
}

const GROUPS: readonly ChatParityGroup[] = ['notes', 'themes', 'identity', 'templates']

/** The frame's request id when it has a usable one (an answer needs it), else null: such a frame is dropped unanswered. */
export function chatParityRequestId(message: unknown): string | null {
  const payload = (message as { payload?: unknown } | null)?.payload as { request_id?: unknown } | null | undefined
  const id = payload && typeof payload === 'object' ? payload.request_id : null
  return typeof id === 'string' && id.trim() ? id : null
}

/** True when the frame is this change's request frame (its type, whatever the rest). */
export function isChatParityRequestFrame(message: unknown): boolean {
  return Boolean(message) && typeof message === 'object' && (message as { type?: unknown }).type === CHAT_PARITY_FRAMES.request
}

/**
 * Reads a request frame. null when it is not one, or has no usable request id. A well-formed request whose group is unknown, whose group
 * is off in this build, or whose action is not the group's, still comes back (with its group as read, `action` as read) so the page can
 * answer it honestly (`flag_off` / `unsupported`): see chatParityRefusal.
 */
export function chatParityRequest(message: unknown): ChatParityRequest | null {
  if (!isChatParityRequestFrame(message)) return null
  const requestId = chatParityRequestId(message)
  if (!requestId) return null
  const payload = (message as { payload: Record<string, unknown> }).payload
  const group = typeof payload.group === 'string' ? payload.group : ''
  const action = typeof payload.action === 'string' ? payload.action : ''
  const args = payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args) ? { ...(payload.args as Record<string, unknown>) } : {}
  return {
    requestId,
    group: group as ChatParityGroup,
    action,
    presentationId: typeof payload.presentation_id === 'string' && payload.presentation_id ? payload.presentation_id : null,
    args,
    label: typeof payload.label === 'string' ? payload.label : '',
  }
}

/** Why a read request cannot run in this build, or null when it can: an unknown or off group is `flag_off`, an action outside the group's list is `unsupported`. */
export function chatParityRefusal(request: ChatParityRequest, flags: Readonly<ChatParityFlags> = CHAT_PARITY_FLAGS): ChatParityErrorCode | null {
  if (!GROUPS.includes(request.group) || flags[request.group] !== true) return 'flag_off'
  if (!CHAT_PARITY_ACTIONS[request.group].includes(request.action)) return 'unsupported'
  return null
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The result frame (Studio -> Director)
// ---------------------------------------------------------------------------------------------------------------------------------------

export interface ChatParityResultData {
  [key: string]: unknown
  status: ChatParityStatus
  error_code: ChatParityErrorCode | null
  detail?: Record<string, unknown>
}

/** The result frame's data: the id under CHAT_PARITY_RESULT_ID_KEY, the status, an error code only on `failed`, a detail only when given. */
export function chatParityResult(
  requestId: string, status: ChatParityStatus, errorCode: ChatParityErrorCode | null = null, detail?: Record<string, unknown>,
): ChatParityResultData {
  const data: ChatParityResultData = { [CHAT_PARITY_RESULT_ID_KEY]: requestId, status, error_code: status === 'failed' ? errorCode : null }
  if (detail && Object.keys(detail).length > 0) data.detail = detail
  return data
}

/** The whole outbound frame: the data under `payload` (DIRECTOR-2, 27 Oct 03:59Z: Director reads `payload` or `data`; it sends under `payload`). */
export function chatParityResultFrame(data: ChatParityResultData): { type: string; payload: ChatParityResultData } {
  return { type: CHAT_PARITY_FRAMES.result, payload: data }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The bus between the socket hook and the Builder page (the flowBus idiom of lib/studio-flow-control.ts): the hook hands frames to it and
// registers its sender; the page sets the handlers AFTER its runners (so no line of this change sits before the older proofs' page regions).
// One socket per page, so one module-level record. Every flag off: nothing is set and nothing is called.
// ---------------------------------------------------------------------------------------------------------------------------------------

export interface ChatParityOwner {
  sessionId: string | null
  isCurrent: () => boolean
}

export interface ChatParityRequestFrame {
  type: string
  session_id?: string
  payload: Record<string, unknown>
}

export const chatParityBus: {
  /** The page's runner of a studio_action frame (set with a group flag on). */
  request: ((message: ChatParityRequestFrame, owner: ChatParityOwner) => void) | null
  /** The page's handler of deck_mutation notes_updated (set with the notes flag on). */
  notes: ((update: ChatParityNotesUpdate, owner: ChatParityOwner) => void) | null
  /** The hook's sender of the result frame (set while the hook is mounted). */
  send: ((data: ChatParityResultData) => boolean) | null
} = { request: null, notes: null, send: null }

// ---------------------------------------------------------------------------------------------------------------------------------------
// NOTES (rows 105/106/108): Director's deck_mutation {mutation:"notes_updated"} and the panel's re-read
// ---------------------------------------------------------------------------------------------------------------------------------------

export const CHAT_PARITY_NOTES_MUTATION = 'notes_updated'
/** The window event the Notes panel listens for (same idiom as deckster:narration-script-written); detail = ChatParityNotesUpdate. */
export const CHAT_PARITY_NOTES_EVENT = 'deckster:slide-notes-updated'
/** The slide fields Director may name (Layout's top-level narration fields). An unknown name is dropped; none named means "re-read all". */
export const CHAT_PARITY_NOTES_FIELDS: readonly string[] = ['speaker_notes', 'script', 'references']

export interface ChatParityNotesUpdate {
  presentationId: string
  slideIndex: number
  fields: string[]
}

/** The notes update a deck_mutation payload describes, or null when it is not one (any other mutation, a bad index or no presentation). */
export function chatParityNotesUpdate(payload: unknown): ChatParityNotesUpdate | null {
  if (!payload || typeof payload !== 'object') return null
  const value = payload as { mutation?: unknown; slide_index?: unknown; presentation_id?: unknown; fields?: unknown }
  if (value.mutation !== CHAT_PARITY_NOTES_MUTATION) return null
  if (typeof value.presentation_id !== 'string' || !value.presentation_id) return null
  if (!Number.isInteger(value.slide_index) || (value.slide_index as number) < 0) return null
  const fields = Array.isArray(value.fields) ? (value.fields as unknown[]).filter((f): f is string => typeof f === 'string' && CHAT_PARITY_NOTES_FIELDS.includes(f)) : []
  return { presentationId: value.presentation_id, slideIndex: value.slide_index as number, fields }
}
