/**
 * FRONTEND-2 Pass 3: refine an element from chat, the WIRE half (NEXT_PUBLIC_CHAT_ELEMENT_REFINE, exact "true", default off, read at build
 * time). What the Director socket hook needs and nothing else, with no imports, so the hook gains no dependency. The runner and the
 * selection-to-reference rule are in lib/chat-element-refine.ts.
 *
 * Contract: ops/program/pass3/DIRECTOR-2-REFINE-ELEMENT-DESIGN.md §5 and streams/frontend/pass3/REFINE-ELEMENT-STUDIO-NOTES.md.
 */

export const CHAT_ELEMENT_REFINE_ENABLED = process.env.NEXT_PUBLIC_CHAT_ELEMENT_REFINE === 'true'

/** The capability Director checks before it sends `element_refine_directive` (design §5). */
export const ELEMENT_REFINE_CLIENT_CAP = 'element_refine1'
export const ELEMENT_REFINE_DIRECTIVE_TYPE = 'element_refine_directive'

export type ElementRefineStatus = 'refined' | 'failed' | 'dismissed'
export type ElementRefineErrorCode = 'not_owner' | 'element_not_found' | 'viewer_unavailable' | 'generation_failed' | 'timeout'

/** Outbound `element_directive_result.data` for a refine directive (design §5). */
export interface ElementRefineResultData {
  directive_id: string
  status: ElementRefineStatus
  element_id: string | null
  error_code: ElementRefineErrorCode | null
}

export interface ElementRefineDirectivePayload {
  directive_id: string
  presentation_id: string
  slide_index: number
  slide_id?: string | null
  element_id: string
  element_type?: string | null
  instruction: string
}

export interface ElementRefineDirectiveMessage {
  type: 'element_refine_directive'
  message_id?: string
  session_id?: string
  timestamp?: string
  payload: ElementRefineDirectivePayload
}

/** Who delivered a directive: the socket's session, and whether that socket is still the live one (the answer goes back on it). */
export interface ElementRefineDirectiveOwner {
  sessionId: string | null
  isCurrent: () => boolean
}

/** One `{kind:'element'}` reference (design §3; Director !511 rules 1, 2 and 4 are applied where it is built). */
export interface ChatElementReference {
  kind: 'element'
  element_id: string
  element_type: string
  slide_index: number
  slide_id: string | null
  label: string
}

/**
 * Adds the capability and the (optional) element reference to a built `user_message.data`, in place. Called only with the flag on.
 * The capability goes after whatever caps are there (mdc1 when NEXT_PUBLIC_CHAT_DIRECTIVES is on); the reference after any slide
 * references (NEXT_PUBLIC_CHAT_MENTIONS), and never a second element reference.
 */
export function addChatElementRefineFields(data: Record<string, unknown>, reference: ChatElementReference | null): Record<string, unknown> {
  const caps = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter(cap => typeof cap === 'string') as string[] : []
  data.client_caps = caps.includes(ELEMENT_REFINE_CLIENT_CAP) ? caps : [...caps, ELEMENT_REFINE_CLIENT_CAP]
  if (reference) {
    const existing = Array.isArray(data.references) ? (data.references as Array<{ kind?: unknown }>) : []
    if (!existing.some(ref => ref?.kind === 'element')) data.references = [...existing, reference]
  }
  return data
}

/** The directive's id when it has a usable one (an answer needs it), else null: such a frame is dropped unanswered. */
export function elementRefineDirectiveId(message: unknown): string | null {
  const payload = (message as { payload?: unknown } | null)?.payload as { directive_id?: unknown } | null | undefined
  const id = payload && typeof payload === 'object' ? payload.directive_id : null
  return typeof id === 'string' && id.trim() ? id : null
}
