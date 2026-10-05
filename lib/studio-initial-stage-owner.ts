import type { StudioInitialStageTarget } from './studio-initial-stage-admission'

export interface StudioAutomaticBlankOrigin {
  readonly token: object
  readonly userId: string
  readonly sessionId: string
  readonly presentationId: string | null
  readonly presentationUrl: string
}

export interface StudioInitialStageOwnerObservation {
  readonly automatic: StudioAutomaticBlankOrigin | null
  readonly selected: StudioInitialStageTarget | null
  readonly authUserId: string | null
  readonly currentSessionId: string | null
  readonly wsSessionId: string | null
  readonly rawRouteSessionId: string | null
  readonly templateMode: boolean
  /** Explicit caller knowledge. A pending, failed or uncertain restore retires
   * this initial-only proof; lack of an outline/count is not this authority. */
  readonly restoration: 'none' | 'pending' | 'restored' | 'failed' | 'unknown'
  readonly nativeWorkPresent: boolean | null | undefined
  readonly admittedNativeOwner: object | null
  readonly explicitBlankOwner: object | null
  /** Private receipt of an owned locally-created fresh assignment. It permits
   * capture at the current owner, including ingress after canonicalization. */
  readonly freshCanonicalEntry?: StudioInitialFreshCanonicalEntry | null
}

interface InitialProof {
  readonly origin: StudioAutomaticBlankOrigin
  readonly target: StudioInitialStageTarget
  readonly rawRouteSessionId: string | null
  readonly templateMode: boolean
  readonly canonicalAdopted: boolean
  readonly freshEntryReceipt: StudioInitialFreshCanonicalEntry | null
}

export interface StudioInitialStageOwnerState {
  /** Caller-local lifetime, never persisted. Consumed opaque tokens cannot be
   * re-captured after retirement, including an A→B→A sequence. */
  readonly observedTokens: ReadonlySet<object>
  readonly proof: InitialProof | null
  readonly target: StudioInitialStageTarget | null
  readonly reason: 'empty' | 'captured' | 'retained' | 'canonical_adoption' | 'retired' | 'replayed_token' | 'unproven'
}

export interface StudioInitialRouteAdoptionIntent {
  readonly automaticToken: object
  readonly fromOwner: object
  readonly fromRouteSessionId: string | null
  readonly sessionId: string
  readonly authUserId: string
  readonly presentationId: string
  readonly presentationUrl: string
  readonly templateMode: boolean
}

export interface StudioInitialFreshCanonicalEntry {
  readonly authUserId: string
  readonly sessionId: string
  readonly sourceRouteSessionId: string | null
  readonly isCurrentAssignment: () => boolean
}

export type StudioInitialFreshCreation =
  | { readonly kind: 'local_uuid'; readonly generatedSessionId: string }
  | { readonly kind: 'confirmed_new_session'; readonly generatedSessionId: string; readonly confirmedSessionId: string }

// An intent must come from the local factory, never a persisted/wire-shaped
// object. The factory is called by the existing verified adoption branch.
const issuedAdoptions = new WeakSet<object>()
const issuedFreshEntries = new WeakSet<object>()
const consumedFreshEntries = new WeakSet<object>()

/** The existing fresh UUID assignment branch calls this before its canonical
 * router replace/push. No ingress token exists yet and no blank is authorized. */
export function createStudioInitialFreshCanonicalEntry(input: {
  readonly authUserId: string | null
  readonly sessionId: string | null
  readonly sourceRouteSessionId: string | null
  /** Exact existing local UUID creation branch, never load/adopt(existing ID). */
  readonly creation: StudioInitialFreshCreation
  readonly assignmentCurrent: boolean
  /** Existing caller's monotonic fresh-assignment lifetime; navigation away
   * and back must remain false, not become current again by matching strings. */
  readonly isCurrentAssignment: () => boolean
  readonly restoration: StudioInitialStageOwnerObservation['restoration']
}): StudioInitialFreshCanonicalEntry | null {
  if (!present(input.authUserId) || !present(input.sessionId) || input.sessionId === 'new'
    || (input.sourceRouteSessionId !== null && !present(input.sourceRouteSessionId))
    || input.sourceRouteSessionId === input.sessionId
    || input.creation.generatedSessionId !== input.sessionId
    || (input.creation.kind !== 'local_uuid' && input.creation.kind !== 'confirmed_new_session')
    || (input.creation.kind === 'confirmed_new_session' && input.creation.confirmedSessionId !== input.sessionId)
    || input.assignmentCurrent !== true || input.restoration !== 'none'
    || typeof input.isCurrentAssignment !== 'function' || !input.isCurrentAssignment()) return null
  const receipt = Object.freeze({ authUserId: input.authUserId, sessionId: input.sessionId, sourceRouteSessionId: input.sourceRouteSessionId,
    isCurrentAssignment: input.isCurrentAssignment })
  issuedFreshEntries.add(receipt)
  return receipt
}

export function initialStudioInitialStageOwnerState(): StudioInitialStageOwnerState {
  return { observedTokens: new Set(), proof: null, target: null, reason: 'empty' }
}

function present(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function exactOrigin(input: StudioInitialStageOwnerObservation): boolean {
  const origin = input.automatic, selected = input.selected
  return !!origin && !!selected && present(origin.userId) && present(origin.sessionId)
    && origin.sessionId !== 'new' && present(origin.presentationId) && present(origin.presentationUrl)
    && origin.userId === input.authUserId && origin.sessionId === input.wsSessionId
    && (input.currentSessionId === null || input.currentSessionId === origin.sessionId)
    && selected.activeVersion === 'blank' && selected.presentationId === origin.presentationId
    && selected.presentationUrl === origin.presentationUrl
}

function safe(input: StudioInitialStageOwnerObservation, previousOwner?: object): boolean {
  const owner = input.selected?.owner
  return input.restoration === 'none' && input.templateMode === false && input.nativeWorkPresent === false
    && input.admittedNativeOwner !== owner && input.explicitBlankOwner !== owner
    && (!previousOwner || (input.admittedNativeOwner !== previousOwner && input.explicitBlankOwner !== previousOwner))
}

function unchangedIdentity(proof: InitialProof, input: StudioInitialStageOwnerObservation): boolean {
  const origin = input.automatic, selected = input.selected
  return exactOrigin(input) && !!origin && !!selected && origin.token === proof.origin.token
    && origin.userId === proof.origin.userId && origin.sessionId === proof.origin.sessionId
    && origin.presentationId === proof.origin.presentationId && origin.presentationUrl === proof.origin.presentationUrl
    && selected.activeVersion === proof.target.activeVersion && input.templateMode === proof.templateMode
}

/** Issue only after the existing owner-fenced same-session create/adoption
 * operation is confirmed, BEFORE setCurrentSessionId/router navigation. This
 * confirms no service operation itself. It never writes or changes any owner. */
export function createStudioInitialRouteAdoptionIntent(
  state: StudioInitialStageOwnerState,
  input: StudioInitialStageOwnerObservation,
  confirmation: { readonly operationCurrent: boolean; readonly confirmedSessionId: string | null },
): StudioInitialRouteAdoptionIntent | null {
  const proof = state.proof
  if (!proof || proof.canonicalAdopted || !unchangedIdentity(proof, input) || !safe(input, proof.target.owner)
    || input.selected?.owner !== proof.target.owner || input.rawRouteSessionId !== proof.rawRouteSessionId
    || (proof.rawRouteSessionId !== null && proof.rawRouteSessionId !== 'new')
    || confirmation.operationCurrent !== true || confirmation.confirmedSessionId !== proof.origin.sessionId
    || !present(proof.origin.presentationId)) return null
  const intent: StudioInitialRouteAdoptionIntent = Object.freeze({
    automaticToken: proof.origin.token, fromOwner: proof.target.owner, fromRouteSessionId: proof.rawRouteSessionId,
    sessionId: proof.origin.sessionId, authUserId: proof.origin.userId,
    presentationId: proof.origin.presentationId, presentationUrl: proof.origin.presentationUrl, templateMode: proof.templateMode,
  })
  issuedAdoptions.add(intent)
  return intent
}

/** Reconcile INITIAL-STAGE proof only. The caller's compose/native owners still
 * retire normally. Exactly one private, confirmed fresh-route→same-session or
 * locally-created assignment's source→new-session adoption may carry this
 * proof to the new selected owner; every other owner
 * or identity/navigation/restore/native-work transition retires it permanently. */
export function reconcileStudioInitialStageOwner(
  state: StudioInitialStageOwnerState,
  input: StudioInitialStageOwnerObservation,
  adoptionIntent: StudioInitialRouteAdoptionIntent | null = null,
): StudioInitialStageOwnerState {
  const origin = input.automatic
  const seen = state.observedTokens
  if (!origin) return { observedTokens: seen, proof: null, target: null, reason: state.proof ? 'retired' : 'empty' }
  const proof = state.proof
  if (!proof || origin.token !== proof.origin.token) {
    if (seen.has(origin.token)) return { observedTokens: seen, proof: null, target: null, reason: 'replayed_token' }
    const observedTokens = new Set(seen).add(origin.token)
    const fresh = input.freshCanonicalEntry
    const freshEntryValid = !!fresh && issuedFreshEntries.has(fresh) && !consumedFreshEntries.has(fresh) && fresh.isCurrentAssignment()
      && fresh.authUserId === origin.userId && fresh.sessionId === origin.sessionId
      && (input.rawRouteSessionId === fresh.sessionId || input.rawRouteSessionId === fresh.sourceRouteSessionId)
    const alreadyCanonicalFresh = freshEntryValid && input.rawRouteSessionId === fresh!.sessionId
    if (!exactOrigin(input) || !safe(input) || (!!fresh && !freshEntryValid)
      || (input.rawRouteSessionId !== null && input.rawRouteSessionId !== 'new' && !freshEntryValid)) {
      return { observedTokens, proof: null, target: null, reason: 'unproven' }
    }
    const captured: InitialProof = {
      origin: Object.freeze({ ...origin }), target: Object.freeze({ ...input.selected! }),
      rawRouteSessionId: input.rawRouteSessionId, templateMode: input.templateMode, canonicalAdopted: alreadyCanonicalFresh,
      freshEntryReceipt: freshEntryValid ? fresh! : null,
    }
    if (freshEntryValid) consumedFreshEntries.add(fresh!)
    return { observedTokens, proof: captured, target: captured.target, reason: 'captured' }
  }
  const retired = (): StudioInitialStageOwnerState => ({ observedTokens: seen, proof: null, target: null, reason: 'retired' })
  if (!unchangedIdentity(proof, input) || !safe(input, proof.target.owner)
    || (proof.freshEntryReceipt && !proof.freshEntryReceipt.isCurrentAssignment())) return retired()
  if (input.rawRouteSessionId === proof.rawRouteSessionId && input.selected?.owner === proof.target.owner) {
    return { ...state, reason: 'retained' }
  }
  const intent = adoptionIntent
  const fresh = proof.freshEntryReceipt
  const freshAssignment = !!fresh && issuedFreshEntries.has(fresh) && fresh.isCurrentAssignment()
    && fresh.authUserId === proof.origin.userId && fresh.sessionId === proof.origin.sessionId
    && fresh.sourceRouteSessionId === proof.rawRouteSessionId
  const confirmedIntent = !!intent && issuedAdoptions.has(intent)
    && intent.automaticToken === proof.origin.token && intent.fromOwner === proof.target.owner
    && intent.fromRouteSessionId === proof.rawRouteSessionId
    && intent.sessionId === proof.origin.sessionId && intent.authUserId === proof.origin.userId
    && intent.presentationId === proof.origin.presentationId && intent.presentationUrl === proof.origin.presentationUrl
    && intent.templateMode === proof.templateMode
  if (proof.canonicalAdopted || (!confirmedIntent && !freshAssignment)
    || (proof.rawRouteSessionId !== null && proof.rawRouteSessionId !== 'new' && !freshAssignment)
    || input.rawRouteSessionId !== proof.origin.sessionId) return retired()
  const adopted: InitialProof = {
    ...proof, target: Object.freeze({ ...input.selected! }), rawRouteSessionId: input.rawRouteSessionId, canonicalAdopted: true,
  }
  return { observedTokens: seen, proof: adopted, target: adopted.target, reason: 'canonical_adoption' }
}
