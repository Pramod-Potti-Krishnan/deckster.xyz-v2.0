// AGENT-MODE-WIRE (FRONTEND-1, stacked on #607 / AGENT-MODE-SHELL): the pure half of mounting the Agent build shell in the Studio. The Builder page owns the run-card state, the build mode and the plan; the socket hook routes the six agent frames and sends the one
// answer; this file holds the parts that must be provable without React or a socket: the page's reducer (a frame goes to #607's reducer; a session change clears the run), when the picker is off, the one rule of an answer (only the open card, only on the live
// socket, only on a click), the words of a failure, and the key that brings a new card into view. It adds nothing of its own to the wire: the frames and their names are #607's (lib/studio-agent-mode.ts, AGENT-1's fixture tests/fixtures/agent_frames_contract.json).
//
// Gate: everything is behind NEXT_PUBLIC_AGENT_MODE "true" AND NEXT_PUBLIC_STUDIO_V4_SHELL "true" (#607's STUDIO_AGENT_MODE_ENABLED, the one constant, reused). With either off the page mounts nothing, the hook routes nothing and sends nothing, and the
// functions here are never reached; the answer rule below refuses on its own too.
//
// Never a paid start without a click: nothing here sends at render, on a frame, on a timer or on a reconnect. A card is answered only by the person's click, through answerAgentCard, and a failed send leaves the card open (nothing queued, nothing replayed).
import { STUDIO_AGENT_MODE_ENABLED, agentAnswerOpenCard, agentAnswered, agentRunReducer, initialAgentRunState, type AgentAnswer, type AgentRunState } from '@/lib/studio-agent-mode'

/** The one local action the page's reducer takes besides a frame: clear the run (the person is in another session now). */
export const AGENT_WIRE_RESET = 'agent_wire_reset'

/** The page's reducer: 'reset' clears the run (an idle state comes back as the same object, so nothing re-renders); anything else is a frame or a local answer for #607's reducer, which refuses what it does not take (the same state comes back). */
export function agentWireReducer(state: AgentRunState, action: unknown): AgentRunState {
  if (action === AGENT_WIRE_RESET) return state.status === 'idle' && state.runId === null ? state : initialAgentRunState()
  return agentRunReducer(state, action)
}

/** A run is in progress (an estimate waiting, running, paused, or stopped and resumable): the build mode must not change under it (Director would stop it as "mode changed"). */
export const agentRunBusy = (state: AgentRunState): boolean => state.status === 'estimate' || state.status === 'running' || state.status === 'paused' || state.status === 'stopped'

/** The page moved from one session to another (or to none): a run, an open card and a picked mode belong to the session they were made in. The first assignment (null to an id, when a new chat is saved by its first message) is not a move. */
export const agentSessionChanged = (previous: string | null, next: string | null): boolean => previous !== null && previous !== next

/** What changes when a card appears, goes, or is answered; steps and credit totals are left out so that a run's progress never pulls the chat. Empty when there is nothing to show. */
export function agentCardsKey(state: AgentRunState): string {
  if (state.status === 'idle' || state.runId === null) return ''
  return [state.runId, state.status, state.estimate ? `A1:${state.estimate.answered ?? ''}` : '', state.pending ? `${state.pending.kind}:${state.pending.answered ?? ''}` : '', state.failure ? `A6:${state.failure.answered ?? ''}` : ''].join('|')
}

/** The words of a failure to send, in plain words and with the next step (credits are never mentioned: nothing here knows a price). */
export const AGENT_WIRE_COPY = {
  answerNotSent: { title: "Couldn't send your choice", description: 'The connection is not ready, so nothing was sent. Try again in a moment.' },
  controlNotSent: (action: 'pause' | 'resume' | 'stop') => ({ title: `Couldn't ${action} the build`, description: 'Director did not take the request. Try again in a moment.' }),
} as const

/** The narration's name for each control request (what the build ribbon marks when it sends the same control). */
export const AGENT_WIRE_CONTROL_MARK = { pause: 'pause_requested', resume: 'resume_requested', stop: 'stop_requested' } as const

export type AgentAnswerOutcome = 'sent' | 'closed' | 'not_sent'
/**
 * The one path of a card answer. `closed`: the flag is off, or the answer is not for the card that is open now (answered already, another run, an estimate past its expires_at): nothing is sent and nothing changes.
 * `not_sent`: the card is open but `send` said no (the socket is not live): nothing was sent, the card stays open, and `notSent` says so with the next step. `sent`: exactly one frame went out, and only then is the card marked answered.
 */
export function answerAgentCard(state: AgentRunState, answer: AgentAnswer, send: (answer: AgentAnswer) => boolean, mark: (action: ReturnType<typeof agentAnswered>) => void, notSent: () => void, nowMs: number = Date.now()): AgentAnswerOutcome {
  if (!STUDIO_AGENT_MODE_ENABLED || !agentAnswerOpenCard(state, answer, nowMs)) return 'closed'
  if (!send(answer)) { notSent(); return 'not_sent' }
  mark(agentAnswered(answer))
  return 'sent'
}
