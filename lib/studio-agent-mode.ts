// AGENT-MODE-SHELL (FRONTEND-2, P4-16 Track A, MR A-F1): the Studio shell for Agent build. Pure and import-free: the flags, the build modes, the typed frames the shell renders from, the run-card reducer,
// credits formatting and the words. The components in components/builder/agent-mode/* draw from this and nothing else; nothing here sends, stores or fetches anything.
//
// Flags (build-time, Next inlines NEXT_PUBLIC_ values; each counts only as the exact string "true", default off, and only with the Studio shell NEXT_PUBLIC_STUDIO_V4_SHELL "true"):
//   NEXT_PUBLIC_AGENT_MODE          the shell: the Agent option in the picker, the estimate card, the run card and cards A3 / A4 / A6.
//   NEXT_PUBLIC_AUTHOR_MODE_PICKER  the Author option in the picker (Author mode has no opt-in in Studio today).
// With both off every component returns null and the hook's frame allow-list gains nothing.
//
// THE AGENT FRAMES CONTRACT (agreed with AGENT-1, 9 Nov; streams/frontend2/AGENT-FRAMES-CONTRACT-FE2.md): the six frames below are read exactly as AGENT-1's shared fixture has them, tests/fixtures/agent_frames_contract.json (copied byte for byte
// from the Director repo, tests/fixtures/agent_frames_contract.json at 476a5617; the proof drives every card from its examples). Director frames are { type, payload }; the one answer is { type: 'agent_answer', data: { run_id, card, choice } }.
// build_mode itself is Director's: an optional "build_mode" key on the user message / the accept message (MR-604, "author" today).

export type BuildMode = 'standard' | 'author' | 'agent'
export const BUILD_MODES: readonly BuildMode[] = ['standard', 'author', 'agent']

/** Exact "true", and only with the Studio shell. */
export const studioAgentModeOn = (agent: string | undefined, shell: string | undefined): boolean => agent === 'true' && shell === 'true'
export const studioAuthorModePickerOn = (author: string | undefined, shell: string | undefined): boolean => author === 'true' && shell === 'true'
export const STUDIO_AGENT_MODE_ENABLED = studioAgentModeOn(process.env.NEXT_PUBLIC_AGENT_MODE, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)
export const STUDIO_AUTHOR_MODE_PICKER_ENABLED = studioAuthorModePickerOn(process.env.NEXT_PUBLIC_AUTHOR_MODE_PICKER, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)

// ---- plans ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The wire plan ids (billing: free / starter / pro / premium; "Max" is the display label of premium, there is no "max" key). The shell never reads a plan from a frame: the page hands it the verified one. */
export type AgentPlan = 'free' | 'starter' | 'pro' | 'premium'
export const agentPlanOf = (raw: unknown): AgentPlan | null => (raw === 'free' || raw === 'starter' || raw === 'pro' || raw === 'premium' ? raw : null)
/** Pro and Max. Anything else, including an unknown plan, is not eligible (fail closed; the server decides anyway). */
export const agentEligible = (plan: AgentPlan | null | undefined): boolean => plan === 'pro' || plan === 'premium'

// ---- the words (one place, so a proof can read every string the shell can say) ---------------------------------------------------------------------------------------------------------
export const AGENT_COPY = {
  heading: 'Agent build',
  pickerLabel: 'Build mode',
  modeLabel: { standard: 'Standard', author: 'Author', agent: 'Agent' } as Record<BuildMode, string>,
  agentNote: 'Pro and Max',
  reasonPlan: 'Agent build is on Pro and Max plans.',
  reasonUnknownPlan: 'Your plan is not loaded yet.',
  estimateLabel: 'Estimated cost', // AGENT-MODE-WIRE
  estimateRunning: 'Running', // AGENT-MODE-WIRE
  estimateMayCap: 'It may stop at the cap.',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  creditsUsed: 'Credits used',
  statusRunning: 'Working',
  statusPaused: 'Paused',
  statusStopped: 'Stopped. Your slides are kept.',
  statusDone: 'Done',
  // AGENT-MODE-WIRE: #607's estimateExpired words are not here, the estimate card has no Start to expire
  checkpointContinue: 'Continue',
  checkpointStop: 'Stop now',
  researchAdd: 'Add research',
  researchStop: 'Stop here',
  failedFallback: 'Build the rest',
  failedStop: 'Keep what is built',
  failedOk: 'OK',
  nothingCharged: 'Nothing was charged.',
  stepFallback: 'Working on your deck',
  reasonFallback: 'Something went wrong.',
} as const

/** Credits only. "N credits" ("1 credit"), whole credits, rounded up (a spend is never shown as less than it was); no currency, ever. A bad number (NaN, infinite, negative, not a number) is 0. */
export function formatCreditsNumber(value: unknown): string {
  const n = typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0
  return n.toLocaleString('en-US')
}
export function formatCredits(value: unknown): string {
  const n = typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`
}
/** A1: "About 470 credits · cap 600 credits" (the frame's one est_credits figure and its cap); the card says it as "Estimated cost: ... · Running" (AGENT_COPY.estimateLabel / estimateRunning). */ // AGENT-MODE-WIRE
export function formatEstimate(est: number, cap: number): string {
  return `About ${formatCredits(est)} · cap ${formatCredits(cap)}`
}
/** True once the estimate's expires_at has passed (at the instant itself too). No expires_at, or one that is not a date, never expires: the frame reader refuses a bad one, so this is only the clock. */
export const estimateExpired = (expiresAt: string | null | undefined, nowMs: number): boolean => {
  if (typeof expiresAt !== 'string') return false
  const at = Date.parse(expiresAt)
  return Number.isFinite(at) && nowMs >= at
}
/** "N of CAP credits", never above the cap: the meter's own words. With no cap known, only the used figure. */
export function formatMeter(used: number, cap: number | null): string {
  if (cap === null) return formatCredits(used)
  return `${formatCreditsNumber(Math.min(used, cap))} of ${formatCredits(cap)}`
}
/** What the meter shows, from 0 to 1, never above the cap. */
export function meterFraction(used: number, cap: number | null): number {
  if (cap === null || !(cap > 0) || !(used > 0)) return 0
  return Math.min(1, used / cap)
}
/** "slide 4", "slides 3–5", "slides 2, 4–6, 9": sorted, unique, whole numbers from 1. */
export function slidesLabel(slides: readonly number[]): string {
  const sorted = [...new Set(slides.filter(n => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b)
  if (sorted.length === 0) return 'your slides'
  const parts: string[] = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(j === i ? `${sorted[i]}` : j === i + 1 ? `${sorted[i]}, ${sorted[j]}` : `${sorted[i]}–${sorted[j]}`)
    i = j + 1
  }
  return `${sorted.length === 1 ? 'slide' : 'slides'} ${parts.join(', ')}`
}

/** A3: "340 of 600 credits used. Continue with up to 260 more credits, or stop now?" (a stop keeps the slides and the run can be resumed). */
export const checkpointWords = (used: number, cap: number, more: number): string => `${formatMeter(used, cap)} used. Continue with up to ${formatCreditsNumber(more)} more ${Math.ceil(more) === 1 ? 'credit' : 'credits'}, or stop now?`
/** A4: "Deeper research on slides 3–5 adds about 40 credits. Add it?" */
export const researchOfferWords = (slides: readonly number[], est: number): string => `Deeper research on ${slidesLabel(slides)} adds about ${formatCredits(est)}. Add it?`
/** A6, what stopped: "The agent stopped at step 7." (no step number when the frame had none). */
export const failedStopWords = (step: number | null): string => (step !== null && step > 0 ? `The agent stopped at step ${Math.floor(step)}.` : 'The agent stopped.')
/** A6, what was charged and what came back, in credits: "Charged 120 credits. 120 credits credited back." */
export const failedMoneyWords = (charged: number, creditedBack: number): string => {
  const parts = [charged > 0 ? `Charged ${formatCredits(charged)}.` : AGENT_COPY.nothingCharged]
  if (creditedBack > 0) parts.push(`${formatCredits(creditedBack)} credited back.`)
  return parts.join(' ')
}
/** A6, what is left of the deck. */
export const failedSlidesWords = (kept: number): string => (kept > 0 ? `${formatCreditsNumber(kept)} ${Math.ceil(kept) === 1 ? 'slide is' : 'slides are'} kept.` : 'No slides were built.')
/** A6, the fallback OFFER (never started by the shell): "Build the rest with the standard build, about 80 credits?" */
export const failedFallbackWords = (credits: number): string => `Build the rest with the standard build, about ${formatCredits(credits)}?`

/** Words that must never reach the screen next to usage: a currency sign, USD, tokens, provider, margin, a router name or a model name. A step or reason that carries one is replaced by the neutral phrase. */
const AGENT_LEAK = /\$|\busd\b|\btokens?\b|\bproviders?\b|\bmargin\b|\bopenrouter\b|\b(gpt|claude|gemini|llama|sonnet|opus|haiku)\b/i
/** Plain words from a server string: markup out, spaces collapsed, at most 160 characters, and the neutral phrase when it would leak. A non-string is the neutral phrase. */
export function plainWords(text: unknown, fallback: string): string {
  if (typeof text !== 'string') return fallback
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean === '' || AGENT_LEAK.test(clean)) return fallback
  return clean.length > 160 ? `${clean.slice(0, 159).trimEnd()}…` : clean
}

// ---- picker -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface BuildModeOption { mode: BuildMode; label: string; disabled: boolean; note: string | null }
export interface BuildModeFlags { agent: boolean; author: boolean }
const FLAGS_NOW: BuildModeFlags = { agent: STUDIO_AGENT_MODE_ENABLED, author: STUDIO_AUTHOR_MODE_PICKER_ENABLED }
/** Standard always; Author only with its flag; Agent only with its flag, and disabled with a plain reason unless the plan is Pro or Max (Free and Starter, and a plan not known yet). */
export function buildModeOptions(plan: AgentPlan | null | undefined, flags: BuildModeFlags = FLAGS_NOW): BuildModeOption[] {
  const out: BuildModeOption[] = [{ mode: 'standard', label: AGENT_COPY.modeLabel.standard, disabled: false, note: null }]
  if (flags.author) out.push({ mode: 'author', label: AGENT_COPY.modeLabel.author, disabled: false, note: null })
  if (flags.agent) {
    const eligible = agentEligible(plan)
    out.push({ mode: 'agent', label: AGENT_COPY.modeLabel.agent, disabled: !eligible, note: eligible ? AGENT_COPY.agentNote : plan ? AGENT_COPY.reasonPlan : AGENT_COPY.reasonUnknownPlan })
  }
  return out
}
/**
 * The "build_mode" a build request carries, or undefined to omit the key (legacy frames are unchanged). Standard is omitted unless the person is switching back from Author or Agent (an explicit reset);
 * Author needs its flag; Agent needs its flag and a Pro or Max plan. A mode that is not allowed is omitted, never sent.
 */
export function buildModeOnWire(mode: BuildMode, opts: { previous?: BuildMode; plan?: AgentPlan | null; flags?: BuildModeFlags } = {}): BuildMode | undefined {
  const flags = opts.flags ?? FLAGS_NOW
  if (mode === 'agent') return flags.agent && agentEligible(opts.plan) ? 'agent' : undefined
  if (mode === 'author') return flags.author ? 'author' : undefined
  return opts.previous === 'author' || opts.previous === 'agent' ? 'standard' : undefined
}

// ---- A6, what stopped: the 50 reason codes of the contract, one short plain sentence each (credits only: never a model, provider, currency, token or router name) ------------------------------------------------
/** Every `agent_failed.reason` code in AGENT-1's fixture (reason_codes), in the fixture's order, with the sentence the card shows. The proof holds this map to the fixture's list both ways and every sentence to plainWords and the leak words. */
export const AGENT_REASON_WORDS: Readonly<Record<string, string>> = {
  agent_error: 'The agent ran into a problem.',
  ambiguous_pending: 'The agent could not tell which question was waiting for your answer.',
  author_unavailable: 'Author build is not available right now.',
  budget: 'The build would go over its credit budget.',
  budget_unavailable: 'Your credit budget could not be checked.',
  build_control: 'The build was stopped from its controls.',
  build_error: 'A slide could not be built.',
  check_failed: 'The final check of your slides did not pass.',
  checkpoint: 'The agent stopped to ask before spending more credits.',
  checkpoint_conflict: 'Two spending checks clashed, so the build stopped.',
  checkpoint_failed: 'The spending check could not be saved.',
  completion_unconfirmed: 'The build finished but could not be confirmed.',
  context_limit: 'This request was too big for the agent to handle in one run.',
  control_error: 'The build controls did not respond.',
  cost_mismatch: 'The credits for a step did not match what was expected.',
  credit_cap: 'The build reached its credit cap.',
  daily_cap: "You have reached today's credit limit for Agent build.",
  deadline: 'The build ran out of time.',
  forbidden: 'Agent build is not allowed for this account.',
  has_content: 'This deck already has slides, so Agent build did not start.',
  invalid_outline: 'The outline could not be used.',
  invalid_plan: "The agent's build plan could not be used.",
  invalid_receipt: 'A credit receipt could not be checked.',
  invalid_reply: 'The agent gave a reply that could not be used.',
  invalid_state: 'The build was in an unexpected state.',
  mixed_mode: 'This deck was started in a different build mode.',
  mixed_unavailable: 'Mixed build is not available right now.',
  mode_changed: 'The build mode changed while the agent was working.',
  model: 'Agent build is not available with your current choices.',
  operation_failed: 'A build step did not finish.',
  outline_approval: 'The outline needs your approval before Agent build can start.',
  outline_invalid: 'The outline has a problem. Please check it and try again.',
  payment_required: 'You need more credits to start this build.',
  preview_changed: 'The preview changed while the agent was working.',
  preview_unverifiable: 'The agent could not check the preview.',
  repair_adapter_unavailable: 'The agent could not fix a slide right now.',
  reservation_unavailable: 'Credits could not be set aside for this build.',
  reuse_failed: 'The matching template could not be used.',
  reuse_unavailable: 'Template matching is not available right now.',
  router_error: 'A build service reported a problem.',
  router_unavailable: 'A build service is not available right now.',
  run_exists: 'A build is already running for this deck.',
  stale_state: 'The deck changed while the agent was working.',
  step_cap: 'The build reached its step limit.',
  stopped: 'The build was stopped.',
  template_mode: 'Agent build is not used with template builds.',
  tier: AGENT_COPY.reasonPlan,
  timeout: 'The build took too long.',
  tool_error: 'A build tool reported a problem.',
  unsupported_route: 'This kind of build is not supported yet.',
}
/** The sentence for a reason code. An unknown code (or anything that is not a string) is "Something went wrong.": a code is never shown as it came. */
export const agentReasonWords = (code: unknown): string => (typeof code === 'string' && Object.prototype.hasOwnProperty.call(AGENT_REASON_WORDS, code) ? AGENT_REASON_WORDS[code] : AGENT_COPY.reasonFallback)

// ---- frames (the agreed contract, AGENT-1's fixture) ------------------------------------------------------------------------------------------------------------------------------------------------
export const AGENT_FRAME_TYPES = ['agent_estimate', 'agent_step', 'agent_checkpoint', 'agent_research_offer', 'agent_failed', 'agent_done'] as const
export type AgentFrameType = (typeof AGENT_FRAME_TYPES)[number]
/** The frame types the socket hook should let through: none with the flag off (today's behaviour: an unknown type is dropped at ingress), the six with it on. */
export const STUDIO_AGENT_FRAME_TYPES: readonly string[] = STUDIO_AGENT_MODE_ENABLED ? AGENT_FRAME_TYPES : []
export const isAgentFrameType = (type: unknown): type is AgentFrameType => typeof type === 'string' && (AGENT_FRAME_TYPES as readonly string[]).includes(type)

/** A1: the estimate ("about N credits, cap M") shown before the paid click; the credits are reserved at that click, not here. `expires_at` (ISO) is optional: once it has passed, Start is off and the card says to ask again. A `model` field, if one is sent, is never read. */
export interface AgentEstimatePayload { run_id: string; est_credits: number; cap_credits: number; expires_at?: string }
/** One step in plain words. `step_state` is the step's own, `run_status` the run's (running / paused / stopped); `credits_used` is the run's total so far. */
export interface AgentStepPayload { run_id: string; step: number; label: string; step_state?: 'running' | 'done' | 'failed'; run_status?: 'running' | 'paused' | 'stopped'; credits_used?: number; cap_credits?: number }
/** A3: "Continue (up to N more) or stop now?". `card` is "A3" and `choices` hold continue and stop. */
export interface AgentCheckpointPayload { run_id: string; card: 'A3'; credits_used: number; more_credits: number; cap_credits: number; choices: readonly ['continue', 'stop'] }
/** A4: deeper research than approved, "Deeper research on slides 3-5 adds about N credits?". `slides` is the 1-based slide numbers (a LIST here; in agent_done it is a count). `card` is "A4", `choices` hold add and skip. */
export interface AgentResearchOfferPayload { run_id: string; card: 'A4'; slides: number[]; est_credits: number; choices: readonly ['add', 'skip'] }
/** A6: what failed and what it cost. `reason` is a CODE (never shown as it came: agentReasonWords). `fallback_credits` present means a priced fallback is OFFERED; the shell never starts one. `step` is optional. */
export interface AgentFailedPayload { run_id: string; reason: string; step?: number; charged_credits: number; credited_back_credits: number; slides_kept?: number; fallback_credits?: number }
/** The run is done. `slides` is a COUNT of the slides built (not a list). The deck's own id (presentation_id) is ignored: the deck arrives through the normal frames. */
export interface AgentDonePayload { run_id: string; slides: number; charged_credits: number }

export type AgentFrame =
  | { type: 'agent_estimate'; payload: AgentEstimatePayload }
  | { type: 'agent_step'; payload: AgentStepPayload }
  | { type: 'agent_checkpoint'; payload: AgentCheckpointPayload }
  | { type: 'agent_research_offer'; payload: AgentResearchOfferPayload }
  | { type: 'agent_failed'; payload: AgentFailedPayload }
  | { type: 'agent_done'; payload: AgentDonePayload }

/** The card ids of the contract: A1 the estimate, A3 the spend checkpoint, A4 the research offer, A6 the failure. */
export type AgentCardId = 'A1' | 'A3' | 'A4' | 'A6'
export type AgentChoice = 'start' | 'cancel' | 'continue' | 'stop' | 'add' | 'skip' | 'fallback'
/** The choices each card takes, as AGENT-1's fixture has them (answer.choices). A1 start is an acknowledgement only; A3 stop and A4 skip are a Stop (the run stays stopped and can be resumed). */
export const AGENT_ANSWER_CHOICES: Readonly<Record<AgentCardId, readonly AgentChoice[]>> = { A1: ['start', 'cancel'], A3: ['continue', 'stop'], A4: ['add', 'skip'], A6: ['fallback', 'stop'] }
const CHOICES = AGENT_ANSWER_CHOICES
const isCard = (v: unknown): v is AgentCardId => v === 'A1' || v === 'A3' || v === 'A4' || v === 'A6'
/** The person's answer to a card. Local: the host sends it (agentAnswerFrame, only if agentAnswerSendable) and tells the reducer (agentAnswered) so the card cannot be answered twice. */
export interface AgentAnswer { runId: string; card: AgentCardId; choice: AgentChoice }
export const agentAnswerValid = (answer: AgentAnswer): boolean => typeof answer.runId === 'string' && answer.runId !== '' && isCard(answer.card) && CHOICES[answer.card].includes(answer.choice)
/** Outbound: the card answer as a socket frame, { type: 'agent_answer', data: { run_id, card, choice } }. Pausing, resuming and stopping a run go through the existing build control, as today. */
export const agentAnswerFrame = (answer: AgentAnswer) => ({ type: 'agent_answer' as const, data: { run_id: answer.runId, card: answer.card, choice: answer.choice } })
/**
 * The one gate before an answer goes out: only on the live, signed socket (the hook passes whether its current socket is open), and only a valid card and choice. The server ignores an answer from an unsigned, other-user, lapsed or
 * superseded socket, so an answer is NEVER queued, retried or replayed after a reconnect: a false here (or a failed send) leaves the card open for another click.
 */
export const agentAnswerSendable = (answer: AgentAnswer, socketOpen: boolean): boolean => socketOpen === true && agentAnswerValid(answer)
/** Local, never from Director: marks a card answered (or, for Cancel on the estimate, clears the run). */
export const agentAnswered = (answer: AgentAnswer) => ({ type: 'agent_answered' as const, payload: { run_id: answer.runId, card: answer.card, choice: answer.choice } })

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' && v.length <= 200 ? v : null)
const credits = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : null)
const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1e6 ? v : null)
const wholeCount = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e6 ? v : null)
const isoTime = (v: unknown): string | null => (typeof v === 'string' && v.length <= 64 && Number.isFinite(Date.parse(v)) ? v : null)
const offersAll = (v: unknown, need: readonly string[]): boolean => Array.isArray(v) && need.every(choice => v.includes(choice))

/** A frame read from a socket message ({ type, payload }): the typed frame with ONLY the fields the shell uses (a padded payload comes out the same), or null when the type is not an agent frame or a field is wrong. */
export function readAgentFrame(raw: unknown): AgentFrame | null {
  if (!isObject(raw) || !isAgentFrameType(raw.type) || !isObject(raw.payload)) return null
  const p = raw.payload, run_id = str(p.run_id)
  if (run_id === null) return null
  switch (raw.type) {
    case 'agent_estimate': {
      const est = credits(p.est_credits), cap = credits(p.cap_credits), expires = p.expires_at === undefined ? undefined : isoTime(p.expires_at)
      return est === null || cap === null || cap <= 0 || expires === null ? null : { type: 'agent_estimate', payload: { run_id, est_credits: est, cap_credits: cap, ...(expires !== undefined ? { expires_at: expires } : {}) } }
    }
    case 'agent_step': {
      const step = whole(p.step), used = p.credits_used === undefined ? undefined : credits(p.credits_used), cap = p.cap_credits === undefined ? undefined : credits(p.cap_credits)
      if (step === null || used === null || cap === null || typeof p.label !== 'string') return null
      const stepState = p.step_state === 'running' || p.step_state === 'done' || p.step_state === 'failed' ? p.step_state : undefined, runStatus = p.run_status === 'running' || p.run_status === 'paused' || p.run_status === 'stopped' ? p.run_status : undefined
      return { type: 'agent_step', payload: { run_id, step, label: plainWords(p.label, AGENT_COPY.stepFallback), ...(stepState ? { step_state: stepState } : {}), ...(runStatus ? { run_status: runStatus } : {}), ...(used !== undefined ? { credits_used: used } : {}), ...(cap !== undefined && cap > 0 ? { cap_credits: cap } : {}) } }
    }
    case 'agent_checkpoint': {
      const used = credits(p.credits_used), more = credits(p.more_credits), cap = credits(p.cap_credits)
      return used === null || more === null || cap === null || cap <= 0 || p.card !== 'A3' || !offersAll(p.choices, CHOICES.A3) ? null : { type: 'agent_checkpoint', payload: { run_id, card: 'A3', credits_used: used, more_credits: more, cap_credits: cap, choices: ['continue', 'stop'] } }
    }
    case 'agent_research_offer': {
      const est = credits(p.est_credits), slides = Array.isArray(p.slides) ? p.slides.map(whole) : null
      return est === null || slides === null || slides.length === 0 || slides.length > 200 || slides.some(n => n === null) || p.card !== 'A4' || !offersAll(p.choices, CHOICES.A4) ? null : { type: 'agent_research_offer', payload: { run_id, card: 'A4', slides: slides as number[], est_credits: est, choices: ['add', 'skip'] } }
    }
    case 'agent_failed': {
      const step = p.step === undefined ? undefined : whole(p.step), charged = credits(p.charged_credits), back = credits(p.credited_back_credits)
      const kept = p.slides_kept === undefined ? undefined : credits(p.slides_kept), fallback = p.fallback_credits === undefined ? undefined : credits(p.fallback_credits)
      if (step === null || charged === null || back === null || kept === null || fallback === null) return null
      return { type: 'agent_failed', payload: { run_id, reason: typeof p.reason === 'string' && p.reason.length <= 80 ? p.reason : '', ...(step !== undefined ? { step } : {}), charged_credits: charged, credited_back_credits: back, ...(kept !== undefined ? { slides_kept: kept } : {}), ...(fallback !== undefined ? { fallback_credits: fallback } : {}) } }
    }
    case 'agent_done': {
      const slides = wholeCount(p.slides), charged = credits(p.charged_credits)
      return slides === null || charged === null ? null : { type: 'agent_done', payload: { run_id, slides, charged_credits: charged } }
    }
  }
  return null
}

// ---- the run-card state and its reducer --------------------------------------------------------------------------------------------------------------------------------------------------------
export type AgentRunStatus = 'idle' | 'estimate' | 'running' | 'paused' | 'stopped' | 'done' | 'failed'
export interface AgentStep { n: number; label: string; stepState: 'running' | 'done' | 'failed' }
export type AgentPending =
  | { kind: 'checkpoint'; usedCredits: number; moreCredits: number; capCredits: number; answered: AgentChoice | null }
  | { kind: 'research_offer'; slides: number[]; estCredits: number; answered: AgentChoice | null }
export interface AgentFailure { step: number | null; reason: string; chargedCredits: number; creditedBackCredits: number; slidesKept: number | null; fallbackCredits: number | null; answered: AgentChoice | null }
export interface AgentRunState {
  runId: string | null
  status: AgentRunStatus
  estimate: { credits: number; expiresAt: string | null; answered: AgentChoice | null } | null
  capCredits: number | null
  usedCredits: number
  steps: AgentStep[]
  pending: AgentPending | null
  failure: AgentFailure | null
  doneSlides: number | null
}
export const initialAgentRunState = (): AgentRunState => ({ runId: null, status: 'idle', estimate: null, capCredits: null, usedCredits: 0, steps: [], pending: null, failure: null, doneSlides: null })
export const AGENT_MAX_STEPS_KEPT = 200
const LIVE: readonly AgentRunStatus[] = ['running', 'paused', 'stopped']
// done and failed are final. `stopped` is NOT: a stopped run can be resumed, and an A3 / A4 card that arrives after run_status "stopped" keeps the run open (the run is stopped and resumable while the card shows; answering it goes back to running).
const TERMINAL: readonly AgentRunStatus[] = ['done', 'failed']

/**
 * The run card's state from a frame. Pure: the same state and frame always give the same result, and a frame it does not take (an unknown type, a wrong field, another run's, a stale one after done / failed) gives the SAME
 * state object back. One run at a time: a second agent_estimate is refused while a run is live. Credits used only go up. Frames carry no tier, user, deck or balance, and any extra field is ignored.
 */
export function agentRunReducer(state: AgentRunState, rawFrame: unknown): AgentRunState {
  const local = isObject(rawFrame) && rawFrame.type === 'agent_answered' && isObject(rawFrame.payload) ? rawFrame.payload : null
  if (local) return answeredState(state, local)
  const frame = readAgentFrame(rawFrame)
  if (!frame) return state
  if (frame.type === 'agent_estimate') {
    const p = frame.payload, estimate = { credits: p.est_credits, expiresAt: p.expires_at ?? null, answered: null }
    if (state.runId === p.run_id) return state.status === 'estimate' && state.estimate !== null && state.estimate.answered === null ? { ...state, estimate, capCredits: p.cap_credits } : state
    if (LIVE.includes(state.status)) return state
    return { ...initialAgentRunState(), runId: p.run_id, status: 'estimate', estimate, capCredits: p.cap_credits }
  }
  // every other frame belongs to the run that is open, or opens one (a frame replayed after a reload); another run's frame and anything after done / failed are stale
  const runId = frame.payload.run_id
  if (state.runId !== null && state.runId !== runId) return state
  if (TERMINAL.includes(state.status)) return state
  const base: AgentRunState = state.runId === null ? { ...state, runId } : state
  switch (frame.type) {
    case 'agent_step': {
      const p = frame.payload
      const at = base.steps.findIndex(s => s.n === p.step), fresh = at === -1
      const step: AgentStep = { n: p.step, label: p.label, stepState: p.step_state ?? 'running' }
      const steps = fresh ? [...base.steps, step].slice(-AGENT_MAX_STEPS_KEPT) : base.steps.map((s, i) => (i === at ? step : s))
      return { ...base, status: p.run_status ?? (fresh || base.status === 'idle' || base.status === 'estimate' ? 'running' : base.status), estimate: null, capCredits: p.cap_credits ?? base.capCredits, usedCredits: Math.max(base.usedCredits, p.credits_used ?? 0), steps, pending: fresh ? null : base.pending }
    }
    case 'agent_checkpoint': {
      const p = frame.payload
      return { ...base, status: base.status === 'idle' || base.status === 'estimate' ? 'running' : base.status, estimate: null, capCredits: p.cap_credits, usedCredits: Math.max(base.usedCredits, p.credits_used), pending: { kind: 'checkpoint', usedCredits: p.credits_used, moreCredits: p.more_credits, capCredits: p.cap_credits, answered: null } }
    }
    case 'agent_research_offer': {
      const p = frame.payload
      return { ...base, status: base.status === 'idle' || base.status === 'estimate' ? 'running' : base.status, estimate: null, pending: { kind: 'research_offer', slides: p.slides, estCredits: p.est_credits, answered: null } }
    }
    case 'agent_failed': {
      const p = frame.payload
      return { ...base, status: 'failed', estimate: null, pending: null, failure: { step: p.step ?? null, reason: agentReasonWords(p.reason), chargedCredits: p.charged_credits, creditedBackCredits: p.credited_back_credits, slidesKept: p.slides_kept ?? null, fallbackCredits: p.fallback_credits ?? null, answered: null } }
    }
    case 'agent_done': {
      const p = frame.payload
      return { ...base, status: 'done', estimate: null, pending: null, usedCredits: Math.max(base.usedCredits, p.charged_credits), doneSlides: p.slides }
    }
  }
  return state
}

function answeredState(state: AgentRunState, raw: Record<string, unknown>): AgentRunState {
  const card = raw.card, choice = raw.choice as AgentChoice, runId = str(raw.run_id)
  if (runId === null || runId !== state.runId || !isCard(card) || !CHOICES[card].includes(choice)) return state
  if (card === 'A1') {
    if (state.status !== 'estimate' || !state.estimate || state.estimate.answered !== null) return state
    return choice === 'cancel' ? initialAgentRunState() : { ...state, estimate: { ...state.estimate, answered: choice } }
  }
  if (card === 'A6') return state.failure && state.failure.answered === null ? { ...state, failure: { ...state.failure, answered: choice } } : state
  const wanted = card === 'A3' ? 'checkpoint' : 'research_offer'
  if (!state.pending || state.pending.kind !== wanted || state.pending.answered !== null) return state
  // A3 continue / A4 add record the consent and resume the run: a run that was stopped (or paused) while the card showed goes back to running. A3 stop / A4 skip are a Stop: the run stays stopped, and can be resumed.
  const resumes = choice === 'continue' || choice === 'add'
  return { ...state, status: LIVE.includes(state.status) ? (resumes ? 'running' : 'stopped') : state.status, pending: { ...state.pending, answered: choice } }
}

/**
 * Whether an answer is for the card that is open right now: the current run's, unanswered, and a choice that card takes (A6 fallback only when one was offered; A1 Start not once the estimate has expired). It mirrors what the server
 * accepts (a run that is not the current one, a card that is not open, or a choice the card does not take is ignored there), so the host never sends one that would only be dropped.
 */
export function agentAnswerOpenCard(state: AgentRunState, answer: AgentAnswer, nowMs: number = Date.now()): boolean {
  if (!agentAnswerValid(answer) || state.runId === null || answer.runId !== state.runId) return false
  switch (answer.card) {
    case 'A1': return state.status === 'estimate' && state.estimate !== null && state.estimate.answered === null && (answer.choice === 'cancel' || !estimateExpired(state.estimate.expiresAt, nowMs))
    case 'A3': return state.pending !== null && state.pending.kind === 'checkpoint' && state.pending.answered === null && !TERMINAL.includes(state.status)
    case 'A4': return state.pending !== null && state.pending.kind === 'research_offer' && state.pending.answered === null && !TERMINAL.includes(state.status)
    case 'A6': return state.status === 'failed' && state.failure !== null && state.failure.answered === null && (answer.choice === 'stop' || state.failure.fallbackCredits !== null)
  }
  return false
}
