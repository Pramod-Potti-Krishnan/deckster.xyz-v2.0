/** Private display admission only. No native command, URL, count, mutation,
 * persistence or narration state is created by this module. */
export interface StudioPartialStageAuthority {
  readonly scope: object
  readonly userId: string
  readonly sessionId: string
  /** Caller epoch keyed by auth/current assignment/raw navigation/template and
   * mounted lifetime. Observed ABA must stay retired. Not socket connectivity. */
  readonly isCurrent: () => boolean
}

export interface StudioPartialStageAssignment {
  readonly userId: string
  readonly sessionId: string
  /** Existing owned metadata/current session or locally-issued fresh assignment
   * proof. A matching URL/session string by itself is not assignment proof. */
  readonly isCurrent: () => boolean
}

export interface StudioPartialStageTransport {
  readonly userId: string
  readonly sessionId: string
  readonly transportGeneration: number
  readonly isCurrent: () => boolean
}

export interface StudioPartialBuildReceipt {
  readonly scope: object
  readonly userId: string
  readonly sessionId: string
  readonly buildId: string
  readonly presentationId: string
}

export type StudioPartialStageVersion = 'blank' | 'strawman' | 'final'
export interface StudioPartialStageVersionIntent {
  readonly scope: object
  readonly buildId: string | null
  readonly version: StudioPartialStageVersion
}

export interface StudioPartialStageSafety {
  readonly presentationId: string | null
  readonly presentationUrl: string | null
  readonly ready: boolean
  readonly dirty: boolean
  readonly busy: boolean
  readonly error: boolean
}

export interface StudioSettledPartialStageDisplayInput {
  readonly authority: StudioPartialStageAuthority
  readonly assignment: StudioPartialStageAssignment
  readonly narrationEnabled: boolean
  readonly templateOverride: boolean
  readonly viewerUrlAllowed: boolean
  readonly versionIntent: StudioPartialStageVersionIntent | null
}

export interface StudioPartialStageDisplayInput extends StudioSettledPartialStageDisplayInput {
  /** Actual current reducer identity, never a guessed/index-derived identity.
   * These gate a NEW transition; raw frames cannot revoke an already displayed
   * artifact that may now have edits of its own. */
  readonly buildId: string | null
  readonly buildPresentationId: string | null
  readonly phase: string
}

export interface StudioPartialStageTransitionInput extends StudioPartialStageDisplayInput {
  readonly receipt: StudioPartialBuildReceipt | null
  /** Exact current old canvas and current Page API registration. */
  readonly selected: { readonly owner: object; readonly presentationId: string; readonly presentationUrl: string }
  readonly native: {
    readonly api: object
    /** Caller-private registration/selected-owner proof. A ready getter or
     * matching URL cannot replace this current auth/session/target authority. */
    readonly isCurrent: () => boolean
    /** Existing composeCaptureSelectionContext: capture itself sends no command.
     * Its predicate pins admitted frame/window/source/load/mount/mode/intent. */
    readonly context: { readonly presentationUrl: string; readonly isCurrent: () => boolean }
    readonly readSafety: () => StudioPartialStageSafety | null
  } | null
}

export interface StudioInitialPartialStageTransitionInput extends StudioPartialStageDisplayInput {
  readonly receipt: StudioPartialBuildReceipt | null
  readonly selected: {
    readonly owner: object
    readonly presentationId: string | null
    readonly presentationUrl: string | null
  }
  /** Positive caller-private certificate only: current locally-issued fresh
   * assignment, no APIs/current safety/ever-admitted native owner, and either
   * exact empty target or existing shouldDeferStudioInitialNative proof. Not
   * an absent URL, missing load, unknown restore or configuration error. */
  readonly isNativeAbsent: () => boolean
}

export interface StudioPartialStageTransition {
  readonly isCurrent: () => boolean
}

export interface StudioSettledPartialStageReceipt extends StudioPartialBuildReceipt {}

const candidates = new WeakMap<StudioPartialBuildReceipt, {
  authority: StudioPartialStageAuthority
  assignment: StudioPartialStageAssignment
  transport: StudioPartialStageTransport
}>()
const intents = new WeakSet<StudioPartialStageVersionIntent>()
const transitions = new WeakMap<StudioPartialStageTransition, {
  receipt: StudioPartialBuildReceipt
  versionIntent: StudioPartialStageVersionIntent | null
}>()
const settled = new WeakMap<StudioSettledPartialStageReceipt, {
  authority: StudioPartialStageAuthority
  versionIntent: StudioPartialStageVersionIntent | null
}>()

function present(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}
function current(check: (() => boolean) | undefined): boolean {
  try { return typeof check === 'function' && check() === true } catch { return false }
}
function owned(authority: StudioPartialStageAuthority, assignment: StudioPartialStageAssignment): boolean {
  return !!authority?.scope && typeof authority.scope === 'object'
    && present(authority.userId) && present(authority.sessionId) && authority.sessionId !== 'new'
    && assignment?.userId === authority.userId && assignment.sessionId === authority.sessionId
    && current(authority.isCurrent) && current(assignment.isCurrent)
}

/** Invoke only from the actual live slide_built callback, with its captured
 * DirectorTransportOwner. History/phase/sync frames cannot mint this receipt. */
export function captureStudioPartialBuildReceipt(input: {
  readonly authority: StudioPartialStageAuthority
  readonly assignment: StudioPartialStageAssignment
  readonly transport: StudioPartialStageTransport | null | undefined
  readonly message: unknown
}): StudioPartialBuildReceipt | null {
  try {
    const { authority, assignment, transport } = input
    if (!owned(authority, assignment) || !transport || transport.userId !== authority.userId
      || transport.sessionId !== authority.sessionId || !Number.isSafeInteger(transport.transportGeneration)
      || transport.transportGeneration < 1 || !current(transport.isCurrent)) return null
    const message = input.message as Record<string, unknown> | null
    const payload = message?.payload as Record<string, unknown> | null
    if (!message || Array.isArray(message) || message.type !== 'slide_built'
      || message.session_id !== authority.sessionId || !payload || typeof payload !== 'object' || Array.isArray(payload)
      || ('session_id' in payload && payload.session_id !== authority.sessionId)
      || !present(payload.build_id) || !present(payload.presentation_id)
      || !Number.isSafeInteger(payload.slide_index) || (payload.slide_index as number) < 0
      || !owned(authority, assignment) || !current(transport.isCurrent)) return null
    const receipt = Object.freeze({ scope: authority.scope, userId: authority.userId,
      sessionId: authority.sessionId, buildId: payload.build_id, presentationId: payload.presentation_id })
    candidates.set(receipt, { authority, assignment, transport })
    return receipt
  } catch { return null }
}

/** Call synchronously before the unchanged switchVersion, even when the chosen
 * value already equals activeVersion. New scope/build identity retires it. */
export function captureStudioPartialStageVersionIntent(input: {
  readonly authority: StudioPartialStageAuthority
  readonly buildId: string | null
  readonly version: StudioPartialStageVersion
}): StudioPartialStageVersionIntent | null {
  if (!input.authority?.scope || typeof input.authority.scope !== 'object'
    || !present(input.authority.userId) || !present(input.authority.sessionId) || input.authority.sessionId === 'new'
    || !current(input.authority.isCurrent) || (input.buildId !== null && !present(input.buildId))
    || !['blank', 'strawman', 'final'].includes(input.version)) return null
  const intent = Object.freeze({ scope: input.authority.scope, buildId: input.buildId, version: input.version })
  intents.add(intent)
  return intent
}

export function hasStudioPartialStageVersionIntent(
  intent: StudioPartialStageVersionIntent | null,
  authority: StudioPartialStageAuthority,
  buildId: string | null,
): boolean {
  return !!intent && intents.has(intent) && intent.scope === authority.scope && intent.buildId === buildId
    && current(authority.isCurrent)
}

function matching(input: StudioPartialStageDisplayInput, receipt: StudioPartialBuildReceipt): boolean {
  return owned(input.authority, input.assignment) && receipt.scope === input.authority.scope
    && receipt.userId === input.authority.userId && receipt.sessionId === input.authority.sessionId
    && receipt.buildId === input.buildId && receipt.presentationId === input.buildPresentationId
    && input.narrationEnabled === true && input.templateOverride === false && input.viewerUrlAllowed === true
    && ['building', 'qa', 'finalizing', 'paused', 'stopped', 'error'].includes(input.phase)
    && !hasStudioPartialStageVersionIntent(input.versionIntent, input.authority, input.buildId)
}

function candidateCurrent(input: StudioPartialStageDisplayInput, receipt: StudioPartialBuildReceipt): boolean {
  const proof = candidates.get(receipt)
  return !!proof && matching(input, receipt) && current(proof.authority.isCurrent)
    && current(proof.assignment.isCurrent) && current(proof.transport.isCurrent)
}

/** A pending distinct transition has no display authority yet. Recheck inside
 * the actual queued updater/commit; a retired transition cannot revive by ABA. */
export function prepareStudioPartialStageTransition(
  readCurrent: () => StudioPartialStageTransitionInput,
): StudioPartialStageTransition | null {
  let first: StudioPartialStageTransitionInput
  try { first = readCurrent() } catch { return null }
  const receipt = first?.receipt, native = first?.native
  const proof = receipt && candidates.get(receipt)
  if (!receipt || !proof || !native || !first.selected?.owner || !native.context
    || !present(first.selected.presentationId)
    || !present(first.selected.presentationUrl) || first.selected.presentationId === receipt.presentationId
    || native.context.presentationUrl !== first.selected.presentationUrl) return null
  let retired = false
  const factsCurrent = (next: StudioPartialStageTransitionInput) => next.receipt === receipt
    && next.authority.scope === first.authority.scope && next.selected.owner === first.selected.owner
    && next.selected.presentationId === first.selected.presentationId
    && next.selected.presentationUrl === first.selected.presentationUrl
    && next.native?.api === native.api && next.versionIntent === first.versionIntent
    && candidateCurrent(next, receipt)
  const isCurrent = () => {
    if (retired) return false
    try {
      const next = readCurrent()
      const safety = factsCurrent(next) && current(native.isCurrent) && current(native.context.isCurrent) ? next.native?.readSafety() : null
      if (!safety || safety.presentationId !== first.selected.presentationId
        || safety.presentationUrl !== first.selected.presentationUrl || safety.ready !== true
        || safety.dirty !== false || safety.busy !== false || safety.error !== false
        || !current(native.isCurrent) || !current(native.context.isCurrent) || !factsCurrent(readCurrent())) retired = true
    } catch { retired = true }
    return !retired
  }
  const transition = Object.freeze({ isCurrent })
  if (!isCurrent()) return null
  transitions.set(transition, { receipt, versionIntent: first.versionIntent })
  return transition
}

/** The distinct empty/deferred branch has its own positive absence authority;
 * it never substitutes missing native proof for a held or loaded canvas. */
export function prepareStudioInitialPartialStageTransition(
  readCurrent: () => StudioInitialPartialStageTransitionInput,
): StudioPartialStageTransition | null {
  let first: StudioInitialPartialStageTransitionInput
  try { first = readCurrent() } catch { return null }
  const receipt = first?.receipt
  if (!receipt || !candidates.has(receipt) || !first.selected?.owner) return null
  const selected = first.selected
  const empty = selected.presentationId === null && selected.presentationUrl === null
  if (!empty && (!present(selected.presentationId) || !present(selected.presentationUrl)
    || selected.presentationId === receipt.presentationId)) return null
  let retired = false
  const factsCurrent = (next: StudioInitialPartialStageTransitionInput) => next.receipt === receipt
    && next.authority.scope === first.authority.scope && next.selected.owner === selected.owner
    && next.selected.presentationId === selected.presentationId && next.selected.presentationUrl === selected.presentationUrl
    && next.versionIntent === first.versionIntent && candidateCurrent(next, receipt)
  const isCurrent = () => {
    if (retired) return false
    try {
      const next = readCurrent()
      if (!factsCurrent(next) || !current(first.isNativeAbsent) || !current(next.isNativeAbsent)
        || !factsCurrent(readCurrent()) || !current(first.isNativeAbsent)) retired = true
    } catch { retired = true }
    return !retired
  }
  const transition = Object.freeze({ isCurrent })
  if (!isCurrent()) return null
  transitions.set(transition, { receipt, versionIntent: first.versionIntent })
  return transition
}

/** A committed receipt sheds the old frame and socket continuation. Reconnect
 * alone therefore does not hide an already admitted B. No content is saved. */
export function settleStudioPartialStageTransition(
  transition: StudioPartialStageTransition,
): StudioSettledPartialStageReceipt | null {
  const proof = transitions.get(transition)
  if (!proof || !current(transition.isCurrent)) return null
  const receipt = proof.receipt
  const result = Object.freeze({ ...receipt })
  settled.set(result, { authority: candidates.get(receipt)!.authority, versionIntent: proof.versionIntent })
  return result
}

export function isStudioSettledPartialStageCurrent(
  receipt: StudioSettledPartialStageReceipt | null,
  input: StudioSettledPartialStageDisplayInput,
): boolean {
  const proof = receipt && settled.get(receipt)
  if (!receipt || !proof || !current(proof.authority.isCurrent) || !owned(input.authority, input.assignment)
    || receipt.scope !== input.authority.scope || receipt.userId !== input.authority.userId
    || receipt.sessionId !== input.authority.sessionId || input.narrationEnabled !== true
    || input.templateOverride !== false || input.viewerUrlAllowed !== true) return false
  // Every later deliberate choice retires display, including the same value
  // and a choice made during a different raw build. An older intent already
  // superseded at admission of this artifact is not a new user interaction.
  const intent = input.versionIntent
  return (!intent || intent === proof.versionIntent || !intents.has(intent) || intent.scope !== receipt.scope)
    && current(proof.authority.isCurrent) && owned(input.authority, input.assignment)
}
