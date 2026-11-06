// Director ask-card identity (RUN-J1J3-FINAL D-A1 / D-A2 / NEW-E1). Import-free by design: scripts/test-studio-ask-card-identity.mjs
// transpiles it in a bare vm sandbox. Behind NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED (exact "true", default off). Off, every
// helper below returns exactly what Studio did before it existed.
//
// What the run showed:
//  - D-A1: Director builds the plan gate with ONE id for the whole session (msg_plan_confirm_<session>), so the "answered" mark kept
//    by id survived a plan correction and the re-asked card arrived "Answered". An answer belongs to ONE ask, not to an id.
//  - D-A2 / NEW-E1: Director builds every outline gate with a fresh random id, and sends one again on every reconnect while the
//    outline is unapproved, so a stopped deck restored several live copies. Only the newest approval gate may stay enabled, and none
//    while a build is running, paused, stopped or finished.

export const STUDIO_ASK_CARD_IDENTITY_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED === 'true'

interface AskIdentity {
  readonly message_id: string
  readonly timestamp?: unknown
}

/** One ask instance: the id plus the frame's own timestamp. A re-ask that re-uses an id carries a new timestamp. Never the prose. */
export function askInstanceKey(message: AskIdentity): string {
  const stamp = typeof message.timestamp === 'string' || typeof message.timestamp === 'number' ? String(message.timestamp) : ''
  return `${message.message_id}\u0000${stamp}`
}

/** The key under which an answer to this ask is recorded in answeredActionsRef. Off: today's bare message id. */
export function askAnswerKey(message: AskIdentity): string {
  return STUDIO_ASK_CARD_IDENTITY_ENABLED ? askInstanceKey(message) : message.message_id
}

/** Has THIS ask (not merely an ask that shares its id) been answered? */
export function isAskAnswered(answeredIds: ReadonlySet<string>, message: AskIdentity): boolean {
  return answeredIds.has(askAnswerKey(message))
}

/** An approval gate is a plan or outline decision: accept/build, or retry the outline's research. The J1 guard suffixes the outline
 * value with the outline identity ("accept_strawman:<identity>"). */
export function isApprovalGate(actions: readonly { readonly value?: unknown }[] | undefined): boolean {
  return Array.isArray(actions) && actions.some(action => {
    const value = action?.value
    return typeof value === 'string' && (value === 'accept_plan' || value === 'accept_strawman'
      || value.startsWith('accept_strawman:') || value === 'retry_research')
  })
}

export interface AskGateLockInputs {
  readonly generatingFinal?: boolean
  /** NarrationState.phase and .control. */
  readonly narrationPhase?: string | null
  readonly narrationControl?: string | null
  /** The Director's own workflow state (sync_response.current_state, or CONTENT_GENERATED after the final deck). */
  readonly workflowState?: string | null
}

const LOCKING_PHASES = new Set(['building', 'qa', 'finalizing', 'paused', 'stopped'])
const LOCKING_CONTROLS = new Set(['pause_requested', 'paused', 'stopped', 'stop_requested'])
const FINISHED_WORKFLOW_STATES = new Set(['COMPLETE', 'CONTENT_GENERATED'])

/** Off: never locked, so nothing changes. Planning, outline drafting and awaiting_user never lock: a corrected plan's new gate
 * arrives in them and must stay clickable. */
export function askGatesLocked(inputs: AskGateLockInputs): boolean {
  if (!STUDIO_ASK_CARD_IDENTITY_ENABLED) return false
  return Boolean(inputs.generatingFinal)
    || LOCKING_PHASES.has(inputs.narrationPhase ?? '')
    || LOCKING_CONTROLS.has(inputs.narrationControl ?? '')
    || FINISHED_WORKFLOW_STATES.has(inputs.workflowState ?? '')
}

type AskStatus = 'answered' | 'earlier'
interface GateCandidate {
  readonly type?: string
  readonly message_id: string
  readonly payload?: unknown
}

/** While the lock holds, every approval gate that is not already answered or earlier becomes an earlier step (disabled, not live).
 * Returns the SAME map when the flag is off, the lock is open or nothing changes. */
export function lockApprovalGateStatuses(
  statuses: Map<string, AskStatus>,
  messages: readonly GateCandidate[],
  locked: boolean | undefined,
): Map<string, AskStatus> {
  if (!STUDIO_ASK_CARD_IDENTITY_ENABLED || !locked) return statuses
  let next = statuses
  for (const message of messages) {
    if (message.type !== 'action_request' || next.has(message.message_id)) continue
    if (!isApprovalGate((message.payload as { actions?: readonly { value?: unknown }[] } | undefined)?.actions)) continue
    if (next === statuses) next = new Map(statuses)
    next.set(message.message_id, 'earlier')
  }
  return next
}

/** The same lock applied to getDirectorActionPolicy's result: a locked gate is historical, so it is no longer an active action. */
export function lockApprovalGatePolicy<P extends { historicalActions: Map<string, AskStatus>; activeActionIds: Set<string> }>(
  policy: P,
  messages: readonly GateCandidate[],
  locked: boolean | undefined,
): P {
  const historicalActions = lockApprovalGateStatuses(policy.historicalActions, messages, locked)
  if (historicalActions === policy.historicalActions) return policy
  return { ...policy, historicalActions, activeActionIds: new Set([...policy.activeActionIds].filter(id => !historicalActions.has(id))) }
}
