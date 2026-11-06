/**
 * FRONTEND-2 Pass 3 (P3-1 A, chat parity): edit an element from chat, and refresh the Notes panel when Director writes the notes, the WIRE
 * half (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT, exact "true", default off, read at build time). What the Director socket hook needs and nothing
 * else, with no imports, so the hook gains no dependency. The runner is lib/chat-element-edit.ts; the save-ack store is lib/chat-element-edit-save.ts.
 *
 * Contract (DIRECTOR-2, Director flag DIRECTOR_MDC_ELEMENT_EDIT_ENABLED): streams/director2/element-edit/CONTRACT.md, agreed 26 Oct. Every name below is that file's.
 *
 * With the flag on, Studio
 *  - adds `element_edit1` and `notes1` to `user_message.data.client_caps` (on top of mdc1);
 *  - runs Director's `{type:"element_edit", payload:{directive_id, ...}}` (one element, one op: delete / order / place / style) through the viewer's own element
 *    commands and answers `{type:"element_edit_result", payload:{directive_id, ok, error_code?}}` ONCE, `ok:true` only when the viewer's autosave has acknowledged it;
 *  - refreshes the Notes panel on `deck_mutation {payload:{mutation:"notes_updated", presentation_id, slide_index}}` (that one mutation; every other is untouched).
 * Flag off: none of this runs, and the send payload, the socket handling and the page are exactly as before.
 */

export const CHAT_ELEMENT_EDIT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT === 'true'

/** The capabilities Director checks before it sends `element_edit` / `notes_updated` (exact, case-sensitive). */
export const ELEMENT_EDIT_CLIENT_CAP = 'element_edit1'
export const NOTES_CLIENT_CAP = 'notes1'
export const ELEMENT_EDIT_CLIENT_CAPS: readonly string[] = [ELEMENT_EDIT_CLIENT_CAP, NOTES_CLIENT_CAP]
// CHAT-ELEMENT-TEXT-SET (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET, exact "true", default off, read at build time; lib/chat-element-text-set.ts): element_edit op "text" sets a selected text box's words exactly.
export const CHAT_ELEMENT_TEXT_SET_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET === 'true' // CHAT-ELEMENT-TEXT-SET
export const ELEMENT_TEXT_CLIENT_CAP = 'element_text1' // CHAT-ELEMENT-TEXT-SET: Director sends op "text" only to a client that advertises this one (after element_edit1), so neither flip order opens an UNSUPPORTED_OP window

export const ELEMENT_EDIT_DIRECTIVE_TYPE = 'element_edit'
export const ELEMENT_EDIT_RESULT_TYPE = 'element_edit_result'
/** deck_mutation's payload.mutation for a slide's notes written by Director. */
export const NOTES_UPDATED_KIND = 'notes_updated'
/** The window event the Notes panel listens for (the precedent is 'deckster:narration-script-written'). */
export const NOTES_UPDATED_EVENT = 'deckster:chat-notes-updated'

export const ELEMENT_EDIT_OPS = ['delete', 'order', 'place', 'style'] as const
export type ElementEditOp = (typeof ELEMENT_EDIT_OPS)[number]
export const ELEMENT_EDIT_ORDERS = ['front', 'back', 'forward', 'backward'] as const
export type ElementEditOrder = (typeof ELEMENT_EDIT_ORDERS)[number]
/** place: "center" is the horizontal centre and "middle" the vertical one; at least one axis is given. */
export const ELEMENT_EDIT_PLACE_H = ['left', 'center', 'right'] as const
export const ELEMENT_EDIT_PLACE_V = ['top', 'middle', 'bottom'] as const
export interface ElementEditPlace {
  h?: (typeof ELEMENT_EDIT_PLACE_H)[number]
  v?: (typeof ELEMENT_EDIT_PLACE_V)[number]
}
export const ELEMENT_EDIT_ALIGNS = ['left', 'center', 'right'] as const

/** The error codes DIRECTOR-2 reserved. TIMEOUT is Director's own: Studio never sends it. */
export const ELEMENT_EDIT_ERROR_CODES = [
  'ELEMENT_NOT_FOUND', 'SLIDE_CHANGED', 'UNSUPPORTED_OP', 'INVALID_VALUE', 'ELEMENT_LOCKED', 'VIEWER_NOT_READY', 'BUSY', 'SAVE_FAILED',
] as const
export type ElementEditErrorCode = (typeof ELEMENT_EDIT_ERROR_CODES)[number]

export interface ElementEditStyle {
  bold?: boolean
  italic?: boolean
  size_step?: -1 | 1
  /** One of the deck palette ids Layout stores in theme_bindings (accent_1, text_body, ... or the CSS custom property --theme-accent-1). */
  color_token?: string
  align?: 'left' | 'center' | 'right'
}

/** The directive's fields (the agreed envelope). */
export interface ElementEditFields {
  directive_id: string
  session_id?: string
  presentation_id: string
  slide_id?: string | null
  slide_index: number
  element_id: string
  op: ElementEditOp
  order?: ElementEditOrder
  place?: ElementEditPlace
  style?: ElementEditStyle
}

/** The frame: its fields are under `payload` (CONTRACT.md §1, like the other directive families); a flat frame is read as well (elementEditFields). */
export interface ElementEditDirectiveMessage {
  type: 'element_edit'
  message_id?: string
  session_id?: string
  timestamp?: string
  payload?: Partial<ElementEditFields>
  [field: string]: unknown
}

/** Outbound result: `ok:true` means SAVED. `error_code` only when `ok` is false. */
export interface ElementEditResultData {
  directive_id: string
  ok: boolean
  error_code?: ElementEditErrorCode
}

/** Who delivered a directive: the socket's session, and whether that socket is still the live one (the answer goes back on it only then). */
export interface ElementEditDirectiveOwner {
  sessionId: string | null
  isCurrent: () => boolean
}

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)

/** The directive's fields: `payload`, else the frame itself (a flat frame). */
export function elementEditFields(message: unknown): Record<string, unknown> {
  const frame = record(message)
  if (!frame) return {}
  return record(frame.payload) ?? frame
}

/** The directive's id when it has a usable one (an answer needs it), else null: such a frame is dropped unanswered. */
export function elementEditDirectiveId(message: unknown): string | null {
  const id = elementEditFields(message).directive_id
  return typeof id === 'string' && id.trim() ? id : null
}

/** The frame Studio sends back (CONTRACT.md §1): `{type:"element_edit_result", payload:{directive_id, ok, error_code?}}`. Director also accepts it flat; Studio sends the payload form. */
export function elementEditResultFrame(payload: ElementEditResultData): { type: typeof ELEMENT_EDIT_RESULT_TYPE; payload: ElementEditResultData } {
  return { type: ELEMENT_EDIT_RESULT_TYPE, payload }
}

/**
 * Adds element_edit1 and notes1 to a built `user_message.data`, in place, after whatever caps are there. Called only with the flag on.
 */
export function addChatElementEditCaps(data: Record<string, unknown>): Record<string, unknown> {
  const caps = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter(cap => typeof cap === 'string') as string[] : []
  data.client_caps = [...caps, ...ELEMENT_EDIT_CLIENT_CAPS.filter(cap => !caps.includes(cap))]
  if (CHAT_ELEMENT_TEXT_SET_ENABLED && !(data.client_caps as string[]).includes(ELEMENT_TEXT_CLIENT_CAP)) (data.client_caps as string[]).push(ELEMENT_TEXT_CLIENT_CAP) // CHAT-ELEMENT-TEXT-SET: element_text1 after element_edit1 / notes1; flag off: the list is exactly as before
  return data
}

export interface ElementEditRouteContext {
  /** This socket's session, and whether this socket is still the live one. */
  sessionId: string | null
  isCurrent: () => boolean
  /** The hook's own turn unlock (an element_edit frame unlocks the input, like the other directives). */
  unlockTurn: () => void
  onDirective?: ((message: ElementEditDirectiveMessage, owner: ElementEditDirectiveOwner) => void) | null
}

/**
 * The hook's route for Director's `element_edit` frame: true when the frame is this change's (consumed: it never reaches the reducer, the
 * transcript or the cache), false for every other frame. Called only with the flag on.
 */
export function routeElementEditFrame(parsed: { type?: unknown } | null | undefined, ctx: ElementEditRouteContext): boolean {
  if (!parsed || parsed.type !== ELEMENT_EDIT_DIRECTIVE_TYPE) return false
  ctx.unlockTurn()
  if (elementEditDirectiveId(parsed)) ctx.onDirective?.(parsed as unknown as ElementEditDirectiveMessage, { sessionId: ctx.sessionId, isCurrent: ctx.isCurrent })
  return true
}

/** A `deck_mutation` with payload.mutation "notes_updated": the deck and the 0-based slide whose notes Director wrote. */
export interface NotesUpdated {
  presentationId: string
  slideIndex: number
}

export interface NotesUpdatedRouteContext {
  sessionId: string | null
  isCurrent: () => boolean
  /** The deck on screen (the hook's deckMutationOwnerRef). */
  displayed: { deckOwnerSessionId?: string | null; presentationId?: string | null }
  onNotesUpdated?: ((update: NotesUpdated, owner: { sessionId: string | null; isCurrent: () => boolean }) => void) | null
}

/**
 * The hook's route for `deck_mutation {payload:{mutation:"notes_updated"}}` (CONTRACT.md §2: `mutation` is deck_mutation's own discriminator): true when the
 * frame is a notes_updated (consumed here, whether or not it is for the deck on screen), false for every other deck_mutation, which carries on as before.
 * Called only with the flag on.
 */
export function routeNotesUpdatedFrame(parsed: { type?: unknown; session_id?: unknown } | null | undefined, ctx: NotesUpdatedRouteContext): boolean {
  if (!parsed || parsed.type !== 'deck_mutation') return false
  const fields = record((parsed as { payload?: unknown }).payload)
  if (!fields || fields.mutation !== NOTES_UPDATED_KIND) return false
  const presentationId = fields.presentation_id
  const slideIndex = fields.slide_index
  if (parsed.session_id !== ctx.sessionId || !ctx.sessionId) return true
  if (typeof presentationId !== 'string' || !presentationId || typeof slideIndex !== 'number' || !Number.isInteger(slideIndex) || slideIndex < 0) return true
  if (ctx.displayed.deckOwnerSessionId !== ctx.sessionId || ctx.displayed.presentationId !== presentationId) return true
  ctx.onNotesUpdated?.({ presentationId, slideIndex }, { sessionId: ctx.sessionId, isCurrent: ctx.isCurrent })
  return true
}
