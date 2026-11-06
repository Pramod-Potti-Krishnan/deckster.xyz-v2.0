// PASS2 #4: outline review on the canvas (flag NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS, exact "true", default off).
//
// (a) While Director's outline approval gate is live, the Studio canvas shows the outline (the accepted v4 mockup's "A clear path
//     through the story" view) with "Approve & build". That button presses the gate's own approve action through the same
//     handler as the chat card (page.tsx handleActionClick): no new protocol, no new frame.
// (b) The transcript half (a built deck's structure re-sent on reconnect is not drawn as a new outline card) lives in
//     lib/director-history-presentation.ts, beside the other history rules, and is re-exported here.
// Off: nothing here runs and Studio renders exactly as before.
import type { ActionRequest, DirectorMessage, SlideUpdate } from '@/hooks/use-deckster-websocket-v2'
import { directorHistoryTimestamp } from '@/lib/director-chat-history'
import { askAnswerKey, lockApprovalGatePolicy } from '@/lib/director-ask-identity'
import { getDirectorActionPolicy } from '@/lib/studio-director-message-policy'
import { isOutlineFrame, type HistoricalUserTurn } from '@/lib/director-history-presentation'

export { STUDIO_OUTLINE_CANVAS_ENABLED, hideBuiltDeckStructureResends, isOutlineFrame, outlineDeckIdentity } from '@/lib/director-history-presentation'

type GateAction = ActionRequest['payload']['actions'][number]

/** Director's outline approval: "accept_strawman", or "accept_strawman:<outline identity>" under the J1 approval guard. */
export function isOutlineApproveAction(action: { value?: unknown } | null | undefined): boolean {
  const value = action?.value
  return typeof value === 'string' && (value === 'accept_strawman' || value.startsWith('accept_strawman:'))
}

// The transcript's own order (components/builder/message-list.tsx): arrival stamp when there is one, else the frame's timestamp.
function transcriptTime(message: DirectorMessage): number {
  const arrival = (message as DirectorMessage & { clientTimestamp?: unknown }).clientTimestamp
  if (typeof arrival === 'number' && Number.isFinite(arrival)) return arrival
  const time = directorHistoryTimestamp(message.timestamp)
  return Number.isFinite(time) ? time : 0
}

export interface StudioOutlineCanvasSelection {
  /** The live outline approval gate. */
  gate: ActionRequest
  /** Its approve action, pressed as-is by "Approve & build". */
  approve: GateAction
  /** The answer key the chat card records for this gate (lib/director-ask-identity). */
  answerKey: string
  /** The newest outline frame at or before the gate in transcript order. */
  outline: SlideUpdate
}

/** (a) The outline the canvas shows, or null. Liveness is exactly the chat card's: the same action policy, the same build lock and
 * the same answered keys MessageList uses, so the canvas and the chat card can never disagree about whether the gate is open. */
export function selectStudioOutlineCanvas(input: {
  enabled: boolean
  /** Template mode, a running build or anything else that owns the canvas. */
  blocked: boolean
  messages: readonly DirectorMessage[]
  answeredIds: ReadonlySet<string>
  userTurns?: readonly HistoricalUserTurn[]
  sessionId: string | null
  locked?: boolean
}): StudioOutlineCanvasSelection | null {
  if (!input.enabled || input.blocked) return null
  const { activeActionIds } = lockApprovalGatePolicy(
    getDirectorActionPolicy(input.messages, input.answeredIds, input.sessionId, input.userTurns), input.messages, input.locked)
  const ordered = input.messages.map((message, index) => ({ message, index, time: transcriptTime(message) }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
  let outline: SlideUpdate | null = null
  let selection: StudioOutlineCanvasSelection | null = null
  for (const { message } of ordered) {
    if (input.sessionId && message.session_id && message.session_id !== input.sessionId) continue
    if (isOutlineFrame(message)) { outline = message; continue }
    if (message.type !== 'action_request' || !activeActionIds.has(message.message_id)) continue
    const gate = message as ActionRequest
    const approve = gate.payload?.actions?.find(isOutlineApproveAction)
    const answerKey = askAnswerKey(gate)
    if (!approve || input.answeredIds.has(answerKey)) continue
    selection = outline ? { gate, approve, answerKey, outline } : null
  }
  return selection
}

/** Narration phases in which a build owns the canvas. */
export const STUDIO_OUTLINE_CANVAS_BUSY_PHASES: ReadonlySet<string> = new Set(['building', 'qa', 'finalizing', 'paused', 'stopped', 'error'])
