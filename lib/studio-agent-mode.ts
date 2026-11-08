// AGENT-MODE-SHELL (FRONTEND-2, P4-16 Track A, MR A-F1): the Studio shell for Agent build. Pure and import-free: the flags, the build modes, the typed frames the shell renders from, the run-card reducer,
// credits formatting and the words. The components in components/builder/agent-mode/* draw from this and nothing else; nothing here sends, stores or fetches anything.
//
// Flags (build-time, Next inlines NEXT_PUBLIC_ values; each counts only as the exact string "true", default off, and only with the Studio shell NEXT_PUBLIC_STUDIO_V4_SHELL "true"):
//   NEXT_PUBLIC_AGENT_MODE          the shell: the Agent option in the picker, the estimate card, the run card and cards A3 / A4 / A6.
//   NEXT_PUBLIC_AUTHOR_MODE_PICKER  the Author option in the picker (Author mode has no opt-in in Studio today).
// With both off every component returns null and the hook's frame allow-list gains nothing.
//
// CONTRACT PENDING A-D1: DIRECTOR-2 has not published an agent frame shape (searched streams/director2 and streams/pass5). The frame types below are this shell's own, written to the Director envelope Studio
// already reads ({ type, payload }), and are what A-D1 should match or replace. build_mode itself is Director's: an optional "build_mode" key on the user message / the accept message (MR-604, "author" today).

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
  start: 'Start',
  cancel: 'Cancel',
  estimateMayCap: 'It may stop at the cap.',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  creditsUsed: 'Credits used',
  statusRunning: 'Working',
  statusPaused: 'Paused',
  statusStopped: 'Stopped. Your slides are kept.',
  statusDone: 'Done',
  checkpointContinue: 'Continue',
  checkpointFinish: 'Finish now',
  researchAdd: 'Add research',
  researchSkip: 'Skip',
  failedStandard: 'Build the rest',
  failedKeep: 'Keep what is built',
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
/** A1: "About 340–470 credits · cap 600 credits" (one figure when the range is a point). */
export function formatEstimate(low: number, high: number, cap: number): string {
  const lo = Math.ceil(Math.min(low, high)), hi = Math.ceil(Math.max(low, high))
  const range = lo === hi ? formatCredits(hi) : `${formatCreditsNumber(lo)}–${formatCreditsNumber(hi)} credits`
  return `About ${range} · cap ${formatCredits(cap)}`
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

/** A3: "340 of 600 credits used. Continue with up to 260 more credits, or finish now?" */
export const checkpointWords = (used: number, cap: number, more: number): string => `${formatMeter(used, cap)} used. Continue with up to ${formatCreditsNumber(more)} more ${Math.ceil(more) === 1 ? 'credit' : 'credits'}, or finish now?`
/** A4: "Deeper research on slides 3–5 adds about 40 credits. Add it?" */
export const researchOfferWords = (slides: readonly number[], extra: number): string => `Deeper research on ${slidesLabel(slides)} adds about ${formatCredits(extra)}. Add it?`
/** A6, what stopped: "The agent stopped at step 7." (no step number when the frame had none). */
export const failedStopWords = (step: number): string => (step > 0 ? `The agent stopped at step ${Math.floor(step)}.` : 'The agent stopped.')
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

// ---- frames (CONTRACT PENDING A-D1) -----------------------------------------------------------------------------------------------------------------------------------------------------------
export const AGENT_FRAME_TYPES = ['agent_estimate', 'agent_step', 'agent_checkpoint', 'agent_research_offer', 'agent_failed', 'agent_done'] as const
export type AgentFrameType = (typeof AGENT_FRAME_TYPES)[number]
/** The frame types the socket hook should let through: none with the flag off (today's behaviour: an unknown type is dropped at ingress), the six with it on. */
export const STUDIO_AGENT_FRAME_TYPES: readonly string[] = STUDIO_AGENT_MODE_ENABLED ? AGENT_FRAME_TYPES : []
export const isAgentFrameType = (type: unknown): type is AgentFrameType => typeof type === 'string' && (AGENT_FRAME_TYPES as readonly string[]).includes(type)

/** A1: the estimate (credits, low to high) and the cap, shown before the paid click; the credits are reserved at that click, not here. */
export interface AgentEstimatePayload { run_id: string; estimate_low: number; estimate_high: number; cap_credits: number }
/** One step in plain words. `state` is the step's, `status` the run's (running / paused / stopped); `credits_used` is the run's total so far. */
export interface AgentStepPayload { run_id: string; step: number; text: string; state?: 'running' | 'done' | 'failed'; status?: 'running' | 'paused' | 'stopped'; credits_used?: number; cap_credits?: number }
/** A3: at the estimate's high end or 80% of the cap, "Continue (up to N more) or finish now?". */
export interface AgentCheckpointPayload { run_id: string; credits_used: number; more_credits: number; cap_credits: number }
/** A4: deeper research than approved, "Deep research on slides 3-5 adds about N credits?". */
export interface AgentResearchOfferPayload { run_id: string; slides: number[]; extra_credits: number }
/** A6: what failed and what it cost. `fallback_credits` present means a fallback is OFFERED (the standard build, about N credits); the shell never starts one. */
export interface AgentFailedPayload { run_id: string; step: number; reason: string; charged_credits: number; credited_back_credits: number; slides_kept?: number; fallback_credits?: number }
export interface AgentDonePayload { run_id: string; credits_used?: number; slides?: number }

export type AgentFrame =
  | { type: 'agent_estimate'; payload: AgentEstimatePayload }
  | { type: 'agent_step'; payload: AgentStepPayload }
  | { type: 'agent_checkpoint'; payload: AgentCheckpointPayload }
  | { type: 'agent_research_offer'; payload: AgentResearchOfferPayload }
  | { type: 'agent_failed'; payload: AgentFailedPayload }
  | { type: 'agent_done'; payload: AgentDonePayload }

export type AgentCardKind = 'estimate' | 'checkpoint' | 'research_offer' | 'failed'
export type AgentChoice = 'start' | 'cancel' | 'continue' | 'finish' | 'add' | 'skip' | 'standard' | 'keep'
const CHOICES: Record<AgentCardKind, readonly AgentChoice[]> = { estimate: ['start', 'cancel'], checkpoint: ['continue', 'finish'], research_offer: ['add', 'skip'], failed: ['standard', 'keep'] }
const isCard = (v: unknown): v is AgentCardKind => v === 'estimate' || v === 'checkpoint' || v === 'research_offer' || v === 'failed'
/** The person's answer to a card. Local: the host sends it (agentAnswerFrame) and tells the reducer (agentAnswered) so the card cannot be answered twice. */
export interface AgentAnswer { runId: string; card: AgentCardKind; choice: AgentChoice }
export const agentAnswerValid = (answer: AgentAnswer): boolean => typeof answer.runId === 'string' && answer.runId !== '' && isCard(answer.card) && CHOICES[answer.card].includes(answer.choice)
/** Outbound, CONTRACT PENDING A-D1: the card answer as a socket frame. Pausing, resuming and stopping go through the existing build control, as today. */
export const agentAnswerFrame = (answer: AgentAnswer) => ({ type: 'agent_answer' as const, data: { run_id: answer.runId, card: answer.card, choice: answer.choice } })
/** Local, never from Director: marks a card answered (or, for Cancel on the estimate, clears the run). */
export const agentAnswered = (answer: AgentAnswer) => ({ type: 'agent_answered' as const, payload: { run_id: answer.runId, card: answer.card, choice: answer.choice } })

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' && v.length <= 200 ? v : null)
const credits = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : null)
const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1e6 ? v : null)

/** A frame read from a socket message ({ type, payload }): the typed frame with ONLY the fields the shell uses (a padded payload comes out the same), or null when the type is not an agent frame or a field is wrong. */
export function readAgentFrame(raw: unknown): AgentFrame | null {
  if (!isObject(raw) || !isAgentFrameType(raw.type) || !isObject(raw.payload)) return null
  const p = raw.payload, run_id = str(p.run_id)
  if (run_id === null) return null
  switch (raw.type) {
    case 'agent_estimate': {
      const low = credits(p.estimate_low), high = credits(p.estimate_high), cap = credits(p.cap_credits)
      return low === null || high === null || cap === null || cap <= 0 ? null : { type: 'agent_estimate', payload: { run_id, estimate_low: low, estimate_high: high, cap_credits: cap } }
    }
    case 'agent_step': {
      const step = whole(p.step), used = p.credits_used === undefined ? undefined : credits(p.credits_used), cap = p.cap_credits === undefined ? undefined : credits(p.cap_credits)
      if (step === null || used === null || cap === null || typeof p.text !== 'string') return null
      const state = p.state === 'running' || p.state === 'done' || p.state === 'failed' ? p.state : undefined, status = p.status === 'running' || p.status === 'paused' || p.status === 'stopped' ? p.status : undefined
      return { type: 'agent_step', payload: { run_id, step, text: plainWords(p.text, AGENT_COPY.stepFallback), ...(state ? { state } : {}), ...(status ? { status } : {}), ...(used !== undefined ? { credits_used: used } : {}), ...(cap !== undefined && cap > 0 ? { cap_credits: cap } : {}) } }
    }
    case 'agent_checkpoint': {
      const used = credits(p.credits_used), more = credits(p.more_credits), cap = credits(p.cap_credits)
      return used === null || more === null || cap === null || cap <= 0 ? null : { type: 'agent_checkpoint', payload: { run_id, credits_used: used, more_credits: more, cap_credits: cap } }
    }
    case 'agent_research_offer': {
      const extra = credits(p.extra_credits), slides = Array.isArray(p.slides) ? p.slides.map(whole) : null
      return extra === null || slides === null || slides.length === 0 || slides.length > 200 || slides.some(n => n === null) ? null : { type: 'agent_research_offer', payload: { run_id, slides: slides as number[], extra_credits: extra } }
    }
    case 'agent_failed': {
      const step = p.step === undefined ? 0 : (whole(p.step) ?? -1), charged = credits(p.charged_credits), back = credits(p.credited_back_credits)
      const kept = p.slides_kept === undefined ? undefined : credits(p.slides_kept), fallback = p.fallback_credits === undefined ? undefined : credits(p.fallback_credits)
      if (step < 0 || charged === null || back === null || kept === null || fallback === null) return null
      return { type: 'agent_failed', payload: { run_id, step, reason: plainWords(p.reason, AGENT_COPY.reasonFallback), charged_credits: charged, credited_back_credits: back, ...(kept !== undefined ? { slides_kept: kept } : {}), ...(fallback !== undefined ? { fallback_credits: fallback } : {}) } }
    }
    case 'agent_done': {
      const used = p.credits_used === undefined ? undefined : credits(p.credits_used), slides = p.slides === undefined ? undefined : credits(p.slides)
      return used === null || slides === null ? null : { type: 'agent_done', payload: { run_id, ...(used !== undefined ? { credits_used: used } : {}), ...(slides !== undefined ? { slides } : {}) } }
    }
  }
  return null
}

// ---- the run-card state and its reducer --------------------------------------------------------------------------------------------------------------------------------------------------------
export type AgentRunStatus = 'idle' | 'estimate' | 'running' | 'paused' | 'stopped' | 'done' | 'failed'
export interface AgentStep { n: number; text: string; state: 'running' | 'done' | 'failed' }
export type AgentPending =
  | { kind: 'checkpoint'; usedCredits: number; moreCredits: number; capCredits: number; answered: AgentChoice | null }
  | { kind: 'research_offer'; slides: number[]; extraCredits: number; answered: AgentChoice | null }
export interface AgentFailure { step: number; reason: string; chargedCredits: number; creditedBackCredits: number; slidesKept: number | null; fallbackCredits: number | null; answered: AgentChoice | null }
export interface AgentRunState {
  runId: string | null
  status: AgentRunStatus
  estimate: { low: number; high: number; answered: AgentChoice | null } | null
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
    const p = frame.payload
    if (state.runId === p.run_id) return state.status === 'estimate' && state.estimate !== null && state.estimate.answered === null ? { ...state, estimate: { low: p.estimate_low, high: p.estimate_high, answered: null }, capCredits: p.cap_credits } : state
    if (LIVE.includes(state.status)) return state
    return { ...initialAgentRunState(), runId: p.run_id, status: 'estimate', estimate: { low: p.estimate_low, high: p.estimate_high, answered: null }, capCredits: p.cap_credits }
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
      const step: AgentStep = { n: p.step, text: p.text, state: p.state ?? 'running' }
      const steps = fresh ? [...base.steps, step].slice(-AGENT_MAX_STEPS_KEPT) : base.steps.map((s, i) => (i === at ? step : s))
      return { ...base, status: p.status ?? (fresh || base.status === 'idle' || base.status === 'estimate' ? 'running' : base.status), estimate: null, capCredits: p.cap_credits ?? base.capCredits, usedCredits: Math.max(base.usedCredits, p.credits_used ?? 0), steps, pending: fresh ? null : base.pending }
    }
    case 'agent_checkpoint': {
      const p = frame.payload
      return { ...base, status: base.status === 'idle' || base.status === 'estimate' ? 'running' : base.status, estimate: null, capCredits: p.cap_credits, usedCredits: Math.max(base.usedCredits, p.credits_used), pending: { kind: 'checkpoint', usedCredits: p.credits_used, moreCredits: p.more_credits, capCredits: p.cap_credits, answered: null } }
    }
    case 'agent_research_offer': {
      const p = frame.payload
      return { ...base, status: base.status === 'idle' || base.status === 'estimate' ? 'running' : base.status, estimate: null, pending: { kind: 'research_offer', slides: p.slides, extraCredits: p.extra_credits, answered: null } }
    }
    case 'agent_failed': {
      const p = frame.payload
      return { ...base, status: 'failed', estimate: null, pending: null, failure: { step: p.step, reason: p.reason, chargedCredits: p.charged_credits, creditedBackCredits: p.credited_back_credits, slidesKept: p.slides_kept ?? null, fallbackCredits: p.fallback_credits ?? null, answered: null } }
    }
    case 'agent_done': {
      const p = frame.payload
      return { ...base, status: 'done', estimate: null, pending: null, usedCredits: Math.max(base.usedCredits, p.credits_used ?? 0), doneSlides: p.slides ?? null }
    }
  }
  return state
}

function answeredState(state: AgentRunState, raw: Record<string, unknown>): AgentRunState {
  const card = raw.card, choice = raw.choice as AgentChoice, runId = str(raw.run_id)
  if (runId === null || runId !== state.runId || !isCard(card) || !CHOICES[card].includes(choice)) return state
  if (card === 'estimate') {
    if (state.status !== 'estimate' || !state.estimate || state.estimate.answered !== null) return state
    return choice === 'cancel' ? initialAgentRunState() : { ...state, estimate: { ...state.estimate, answered: choice } }
  }
  if (card === 'failed') return state.failure && state.failure.answered === null ? { ...state, failure: { ...state.failure, answered: choice } } : state
  const wanted = card === 'checkpoint' ? 'checkpoint' : 'research_offer'
  return state.pending && state.pending.kind === wanted && state.pending.answered === null ? { ...state, pending: { ...state.pending, answered: choice } } : state
}
