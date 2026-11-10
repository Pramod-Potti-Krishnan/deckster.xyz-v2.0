// PASS2B chat touches (E2E-2, J1-10 and J1-17): the two pieces of logic that are derived at render from state the Builder page already holds.
//
// Pure and import-free. Nothing here sends, stores, retries or reconnects anything, and nothing here writes to the WebSocket hook, the
// reducer, the cache, the transcript or any React key. The flags are read by the callers (build-time `NEXT_PUBLIC_*` literals, exact "true",
// Studio shell only, default off):
//
//   NEXT_PUBLIC_STUDIO_CHAT_EDIT_PROMPT   J1-10  after "I'd like to make changes" (or "Make some changes") the composer is focused and its
//                                                placeholder says what to type. Derived from the transcript: see studioChatEditPromptActive.
//   NEXT_PUBLIC_STUDIO_CHAT_ERROR_CLEAR   J1-17  a Director error notice (and the calm recovery card it feeds) goes away once the user has
//                                                sent another turn and Director has answered. See errorNoticeStaleAfterRetry.

/** The action values Director sends for "I'd like to make changes" on the plan gate and "Make some changes" on the outline gate. */
export const STUDIO_EDIT_ACTION_VALUES: readonly string[] = ['reject_plan', 'request_refinement']

/** The placeholder while the composer waits for the user's changes (J1-10). */
export const STUDIO_EDIT_PROMPT_PLACEHOLDER = 'Tell Director what to change…'

interface UserTurnLike { text?: string }
/** Any Director frame: only `type` and, for an action request, `payload.actions` are read (the payload is typed per frame type, so it is not narrowed here). */
interface DirectorMessageLike { type?: string; payload?: unknown }
interface ActionLike { label?: string; value?: string }

/**
 * J1-10: true while the user's most recent turn is the click on an "edit" action and nothing has been typed since.
 *
 * Read from the transcript only (no handler is touched): the click is recorded as a user turn whose text is the action's label, so the
 * last user turn is compared with the labels of the `reject_plan` / `request_refinement` actions in Director's own action requests. Any
 * later turn (the typed changes, or anything else) makes it false again, so the hint never outlives the moment it is for. A user who types
 * the same words by hand gets the same, harmless, hint.
 */
export function studioChatEditPromptActive(
  userMessages: ReadonlyArray<UserTurnLike> | null | undefined,
  messages: ReadonlyArray<DirectorMessageLike> | null | undefined,
): boolean {
  if (!userMessages || userMessages.length === 0) return false
  const last = userMessages[userMessages.length - 1]
  const text = typeof last?.text === 'string' ? last.text.trim() : ''
  if (!text || !messages) return false
  for (const message of messages) {
    if (message?.type !== 'action_request') continue
    const actions = (message.payload as { actions?: ReadonlyArray<ActionLike> } | undefined)?.actions ?? []
    for (const action of actions) {
      if (typeof action?.value === 'string' && STUDIO_EDIT_ACTION_VALUES.includes(action.value)
        && typeof action.label === 'string' && action.label.trim() === text) return true
    }
  }
  return false
}

/** What was true the first time a given notice was drawn. */
export interface ErrorNoticeBaseline {
  /** The notice object the Director hook holds; a new notice is a new object. */
  notice: object
  userTurns: number
  botMessages: number
}

/**
 * J1-17: the baseline for the current notice. Kept while the same notice object stays; replaced when the hook raises a new one (so a retry
 * that fails again shows its own, fresh notice); null when there is no notice.
 */
export function nextErrorNoticeBaseline(
  previous: ErrorNoticeBaseline | null,
  notice: object | null | undefined,
  userTurns: number,
  botMessages: number,
): ErrorNoticeBaseline | null {
  if (!notice) return null
  return previous && previous.notice === notice ? previous : { notice, userTurns, botMessages }
}

/**
 * J1-17: a notice is stale once, after it was first drawn, the user has sent another turn AND Director has answered with at least one more
 * message. Both counts come from the transcript the page already holds. A failed retry raises a new notice object (new baseline), so only a
 * retry that really got through clears it. The notice itself is never written to; this only decides whether to draw it.
 */
export function errorNoticeStaleAfterRetry(baseline: ErrorNoticeBaseline | null, userTurns: number, botMessages: number): boolean {
  return Boolean(baseline) && userTurns > baseline!.userTurns && botMessages > baseline!.botMessages
}
