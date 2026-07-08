/**
 * MDC — Multi-Directional Chat contracts (DIRECTOR_INTERFACE_REFINEMENT_PLAN.md §4).
 *
 * P0: type declarations only — nothing imports this file yet. Each phase wires
 * the piece it ships. All shapes mirror backend/director's
 * src/models/websocket_messages.py MDC section 1:1.
 *
 * K6 rule: the Director only sends session_directive / deck_mutation /
 * element_directive to clients that advertised `client_caps` containing
 * "mdc1"; the FE advertises it on the connect query (?caps=mdc1) and on every
 * user_message.data — both only when NEXT_PUBLIC_CHAT_DIRECTIVES is on.
 */

export const MDC_CLIENT_CAP = 'mdc1'

// ---- K1: slide references on user_message.data ------------------------------

export interface SlideReference {
  kind: 'slide' // 'element' reserved for v2 (§12-Q5 locked: slides only)
  index: number // 0-based
  slide_id?: string | null
  label?: string // slide title at mention time; Director quotes it back in confirms
}

/** Additive fields the MDC phases add to UserMessage['data']. */
export interface MdcUserMessageData {
  references?: SlideReference[]
  client_caps?: string[]
  /** Present only when answering a structured question_set (K2). */
  question_answers?: Record<string, string>
}

// ---- K2: structured questions riding action_request -------------------------

export interface QuestionSuggestion {
  label: string
  recommended?: boolean
}

export interface QuestionSpec {
  id: string
  text: string
  suggestions: QuestionSuggestion[]
  allow_free_text: boolean
}

export interface QuestionSet {
  id: string
  questions: QuestionSpec[]
}

/** action_request payload may additively carry question_set (old payloads never do). */
export interface MdcActionPayloadExtras {
  question_set?: QuestionSet
}

// ---- K3: session_directive ---------------------------------------------------

export interface SessionDirectivePayload {
  directive: 'new_session'
  reason: string // e.g. 'one_deck_per_session'
  prefill_prompt?: string | null
  auto_send: boolean // §12-Q2 locked: true
}

export interface SessionDirectiveMessage {
  type: 'session_directive'
  message_id: string
  session_id: string
  timestamp: string
  payload: SessionDirectivePayload
}

// ---- K4: deck_mutation ---------------------------------------------------------

export type DeckMutationKind =
  | 'slide_deleted'
  | 'slide_replaced'
  | 'slide_reordered'
  | 'slide_added'

export interface DeckMutationPayload {
  mutation: DeckMutationKind
  slide_index: number
  new_slide_index?: number | null
  presentation_id: string
  presentation_url?: string | null
  /** Cache-buster for the viewer's ?sc_refresh reload idiom. */
  refresh_token: string
}

export interface DeckMutationMessage {
  type: 'deck_mutation'
  message_id: string
  session_id: string
  timestamp: string
  payload: DeckMutationPayload
}

// ---- K5: element_directive round-trip ---------------------------------------

export interface ElementDirectivePayload {
  directive_id: string
  /** One of the element panel's types (ADD_ELEMENT_CAPABILITY_MATRIX.md). */
  element_type: string
  prompt: string
  slide_index: number
  grid_hint?: string | null
}

export interface ElementDirectiveMessage {
  type: 'element_directive'
  message_id: string
  session_id: string
  timestamp: string
  payload: ElementDirectivePayload
}

/** Outbound FE → Director result frame for a directive. */
export interface ElementDirectiveResult {
  type: 'element_directive_result'
  data: {
    directive_id: string
    status: 'inserted' | 'failed' | 'dismissed'
    element_id?: string | null
    error?: string | null
  }
}

// ---- K7: capabilities on sync_response ---------------------------------------

export interface MdcSyncExtras {
  chat_capabilities?: Record<string, boolean>
}
