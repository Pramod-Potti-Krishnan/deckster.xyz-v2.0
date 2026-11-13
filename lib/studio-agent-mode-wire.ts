// AGENT-MODE-WIRE (FRONTEND-1, stacked on #607 / AGENT-MODE-SHELL): the pure half of mounting the Agent build shell in the Studio. The Builder page owns the run-card state, the build mode and the plan; the socket hook routes the six agent frames and sends the one
// answer; this file holds the parts that must be provable without React or a socket: the page's reducer (a frame goes to #607's reducer; a session change clears the run), when the picker is off, the one rule of an answer (only the open card, only on the live
// socket, only on a click), the words of a failure, the key that brings a new card into view, and when the picker goes back to Standard (a run that is over). It adds nothing of its own to the wire: the frames and their names are #607's (lib/studio-agent-mode.ts, AGENT-1's fixture tests/fixtures/agent_frames_contract.json).
//
// Gate: everything is behind NEXT_PUBLIC_AGENT_MODE "true" AND NEXT_PUBLIC_STUDIO_V4_SHELL "true" (#607's STUDIO_AGENT_MODE_ENABLED, the one constant, reused). With either off the page mounts nothing, the hook routes nothing and sends nothing, and the
// functions here are never reached; the answer rule below refuses on its own too.
//
// Never a paid start without a click: nothing here sends at render, on a frame, on a timer or on a reconnect. A card is answered only by the person's click, through answerAgentCard, and a failed send leaves the card open (nothing queued, nothing replayed).
import { STUDIO_AGENT_MODE_ENABLED, agentAnswerOpenCard, agentAnswered, agentEligible, agentRunReducer, initialAgentRunState, readAgentFrame, type AgentAnswer, type AgentPlan, type AgentRunState, type BuildMode } from '@/lib/studio-agent-mode'
import { voiceCallBus } from '@/lib/studio-voice-call-ui'

/** The one local action the page's reducer takes besides a frame: clear the run (the person is in another session now). */
export const AGENT_WIRE_RESET = 'agent_wire_reset'

/** A run that is over (done or failed): its card stays on screen until the next run replaces it, but it takes no more frames of its own. */
const agentRunOver = (state: AgentRunState): boolean => state.status === 'done' || state.status === 'failed'

/**
 * The page's reducer: 'reset' clears the run (an idle state comes back as the same object, so nothing re-renders); anything else is a frame or a local answer for #607's reducer, which refuses what it does not take (the same state comes back).
 * One addition to the frame path: once a run is over (done or failed), #607's reducer reads every frame of ANOTHER run as stale and drops it, but the next run's first frame is not always an estimate: a refusal before admission (daily_cap, has_content,
 * run_exists, the fixture's "A refusal before admission carries a fresh run_id") has none, and would show nothing under the finished run's card. So a frame whose run_id differs from the finished run's is read from a clean state (an estimate gives
 * the same result as before); a late frame of the finished run itself is still refused as stale, and a run that is live (running, paused, stopped, or an estimate waiting) is untouched: another run's frame is still refused there.
 */
export function agentWireReducer(state: AgentRunState, action: unknown): AgentRunState {
  if (action === AGENT_WIRE_RESET) return state.status === 'idle' && state.runId === null ? state : initialAgentRunState()
  const frame = agentRunOver(state) ? readAgentFrame(action) : null
  return agentRunReducer(frame !== null && frame.payload.run_id !== state.runId ? initialAgentRunState() : state, action)
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

// ---- NO AGENT START FROM VOICE (PK ruling, 11 Nov) ----------------------------------------------------------------------------------------------------------------------------------------------------
// A send that comes from the voice call (a spoken "yes" to the plan card, a turn of words) must never start an Agent run: that takes the person's click, or a typed send with the picker on Agent. The call sends through the page's own two handlers
// (handleSendMessage for words, handleActionClick for a card's button) and arms the words on the bus (lib/studio-voice-call-ui.ts voiceCallBus.pending) first; the page asks here, at the very top of each handler, whether the words it was just handed are
// the armed ones, and if so reads the build mode below instead of the picker's. The socket hook adds a last line of its own (a user message marked mode "voice" never carries "agent").
/** The page's handler was just handed exactly the words the call armed: this send is the call's. Read at the top of the handler, so a call that ends or cancels the turn while the send waits (a new session, a reconnect) does not make it a typed send. */
export const voiceOriginatedSend = (text: string): boolean => voiceCallBus.pending !== null && voiceCallBus.pending.text === text

/**
 * The build_mode a build send that came from the voice call carries, given the one the picker holds (`wire`, from buildModeOnWire): never "agent". Director keeps the mode a session was last given (an Agent opt-in is sticky, and saved with the session), so
 * leaving the key out would leave an opt-in already in force and the spoken "yes" would start the run anyway. For a plan that can have an opt-in (Pro and Max; Agent is never sent for another) the send says "standard", Director's own way to drop it, which
 * changes nothing when none is held. Another plan: the key stays out, as it always did. Author is not ruled on and stays as it is. With the flags off nothing changes (the picker's mode, which is undefined then).
 */
export function voiceBuildMode(wire: BuildMode | undefined, plan: AgentPlan | null | undefined): BuildMode | undefined {
  if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire
  return agentEligible(plan) ? 'standard' : undefined
}

// ---- STANDARD IS SAID OUT LOUD (PK ruling, 12 Nov: "both yes") -----------------------------------------------------------------------------------------------------------------------------------------
// Director's Agent opt-in is sticky: it is saved with the session, and a message without build_mode leaves it as it was (only an explicit "standard" clears it). The Studio does not read the opt-in back, and the picker starts on Standard after a reload, so a typed send or a click
// with Standard picked, which used to leave the key out, could still run Agent on a session that held an opt-in. The picker is the person's word: on a plan that can hold the opt-in (Pro, Max) a build send with the picker on Standard now says so.
/**
 * The build_mode a typed send or a click on a card's button carries, given the one the picker puts on the wire (`wire`, from buildModeOnWire): Agent and Author as picked; Standard (the key left out, because the person never picked another) says "standard" for a plan that can have an Agent
 * opt-in (Pro, Max), which clears one Director holds and changes nothing when none is held. Free, Starter and a plan that is not loaded: the key stays out, as it always did (Agent is never sent for them, so there is nothing to clear). A reset after Author or Agent is "standard" already.
 * Flags off: the picker's mode, which is undefined then (every frame is today's).
 */
export function typedBuildMode(wire: BuildMode | undefined, plan: AgentPlan | null | undefined): BuildMode | undefined {
  if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire
  return agentEligible(plan) ? 'standard' : undefined
}

// ---- RESET TO STANDARD (PK ruling, 12 Nov) -------------------------------------------------------------------------------------------------------------------------------------------------------------
// An Agent run is one paid job: when it is over, the picker goes back to Standard, so the next message is a plain build unless the person picks Agent again. On Pro and Max Standard is said out loud (typedBuildMode), so that next send also clears the opt-in Director
// holds for the session (it is sticky, and only an explicit "standard" drops it).
// "Over" is the reducer's own terminal states, done and failed (TERMINAL in lib/studio-agent-mode.ts: the two it takes no more frames for; agentRunOver above). A refusal before admission (daily_cap, tier, has_content, run_exists) is a failed run and counts, with or without an
// estimate before it. "Stopped" does NOT count: it is not final, the run can be resumed (an A3 stop or an A4 skip keeps it open, Resume takes it back to running), and the picker is off while it is (agentRunBusy), so the mode never changes under it; a resumed run that
// finishes resets then. It happens once, on the move TO a finished run: never on mount (the page starts idle), never again for the frames of the same finished run that follow (an answered A6 card), and a pick made afterwards stays until another run finishes.
/** The id of the run that is over (done or failed), or null while there is none (idle, an estimate waiting, running, paused, stopped). */
export const agentFinishedRun = (state: AgentRunState): string | null => (agentRunOver(state) ? state.runId : null)

/**
 * The picker's mode once the page's run state has changed. `before` is the finished run's id the page saw last (null from the start, so a page that mounts idle, or reloads, resets nothing); `mode` is what the picker holds. Agent goes back to Standard only when
 * a run that was not already finished is finished now; Author and Standard are left as they are. Flags off: the mode as it is.
 */
export const agentPickerAfterRun = (before: string | null, state: AgentRunState, mode: BuildMode): BuildMode => {
  const finished = agentFinishedRun(state)
  return STUDIO_AGENT_MODE_ENABLED && finished !== null && finished !== before && mode === 'agent' ? 'standard' : mode
}
