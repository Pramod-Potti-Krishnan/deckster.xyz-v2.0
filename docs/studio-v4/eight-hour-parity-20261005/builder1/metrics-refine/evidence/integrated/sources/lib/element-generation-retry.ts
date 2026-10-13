import type { TextLabsRetryStrategy } from '@/lib/textlabs-client'

export type ElementGenerationSubmitIntent = 'generate' | 'retry'

export interface DiagramRetryCandidate {
  attemptId: string
  requestFingerprint: string
}

export const DIAGRAM_BACKEND_CLEANUP_WINDOW_MS = 10_000
export const MINIMUM_DIAGRAM_BACKEND_DEADLINE_MS = 1_000
// Text Labs gives each Diagram Generator call a 60s HTTP budget. A recovered
// fresh attempt must receive that full downstream window; starting G2 with a
// token 1s remainder only spends work on a request the browser cannot observe.
export const MINIMUM_FRESH_DIAGRAM_BACKEND_DEADLINE_MS = 60_000
// Cover the frontend's full planned-element request ceiling so any G1 response
// still observable by the browser can join the same settled G2.
export const DIAGRAM_FRESH_ATTEMPT_HANDOFF_TTL_MS = 150_000
export const DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES = 16

/**
 * Preserve an ambiguous request identity while an explicit retry is still in
 * browser-only preflight. A normal Generate action deliberately abandons the
 * old identity; an explicit Retry consumes it only immediately before the
 * prepared HTTP request is dispatched.
 */
export function diagramRetryCandidateForPreDispatch(
  submitIntent: ElementGenerationSubmitIntent,
  retryCandidate: DiagramRetryCandidate | null,
): DiagramRetryCandidate | null {
  return submitIntent === 'retry' ? retryCandidate : null
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return value.toString()
  if (
    value === undefined
    || typeof value === 'function'
    || typeof value === 'symbol'
  ) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.map(item => canonicalizeFingerprintValue(item) ?? null)
  }
  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  const canonicalEntries = Object.keys(record)
    .sort()
    .flatMap(key => {
      const canonicalValue = canonicalizeFingerprintValue(record[key])
      return canonicalValue === undefined ? [] : [[key, canonicalValue] as const]
    })
  return Object.fromEntries(canonicalEntries)
}

/**
 * Freeze the exact Text Labs request identity into a stable canonical string.
 *
 * Attempt ID and deadline are deliberately omitted: Text Labs excludes those
 * transport fields from its leaf singleflight fingerprint, and the deadline is
 * recomputed from the browser's remaining budget on every explicit retry.
 */
export function diagramGenerationRequestFingerprint(input: {
  sessionId: string
  message: string
  options: Record<string, unknown>
}): string {
  const {
    generationAttemptId: _generationAttemptId,
    deadlineMs: _deadlineMs,
    ...requestOptions
  } = input.options
  return JSON.stringify(canonicalizeFingerprintValue({
    sessionId: input.sessionId,
    message: input.message,
    options: requestOptions,
  }))
}

/**
 * Only the explicit retry affordance may reuse a transport-failed attempt, and
 * only when the fully prepared request is byte-for-byte identical.
 */
export function resolveDiagramGenerationAttemptId(input: {
  submitIntent: ElementGenerationSubmitIntent
  freshAttemptId: string
  requestFingerprint: string
  retryCandidate: DiagramRetryCandidate | null
}): { attemptId: string; reused: boolean } {
  if (
    input.submitIntent === 'retry'
    && input.retryCandidate?.requestFingerprint === input.requestFingerprint
  ) {
    return {
      attemptId: input.retryCandidate.attemptId,
      reused: true,
    }
  }
  return {
    attemptId: input.freshAttemptId,
    reused: false,
  }
}

/**
 * A browser abort after dispatch, transport failure, and gateway 502/503/504
 * cannot prove that Text Labs rejected the request before paid work began.
 * Preserve identity for an explicit retry so it can join/cache-hit the
 * original attempt. Text Labs may preserve downstream gateway ambiguity in
 * its HTTP-200 envelope; other correlated application failures are definitive
 * and start a fresh attempt.
 */
export function isAmbiguousDiagramRequestFailure(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false
  const failure = input as {
    name?: string
    kind?: string
    status?: number | null
    retryable?: boolean
    ambiguousCompletion?: boolean
  }
  if (
    failure.name === 'AbortError'
    || failure.kind === 'transport'
    || failure.ambiguousCompletion === true
  ) {
    return true
  }
  return failure.kind === 'http'
    && failure.retryable === true
    && failure.status !== null
    && failure.status !== undefined
    && [502, 503, 504].includes(failure.status)
}

/**
 * Resolve the panel action from the additive Text Labs contract. Older
 * deployments are mapped from ambiguous_completion/retryable without ever
 * reusing an attempt for an ordinary retryable model failure.
 */
export function diagramRetryStrategyForFailure(
  input: unknown,
): TextLabsRetryStrategy | null {
  if (!input || typeof input !== 'object') return null
  const failure = input as {
    kind?: string
    retryable?: boolean
    retryStrategy?: unknown
    retry_strategy?: unknown
  }
  const explicit = failure.retryStrategy ?? failure.retry_strategy
  if (
    explicit === 'resume_same_attempt'
    || explicit === 'start_fresh_attempt'
    || explicit === 'do_not_retry'
  ) {
    return explicit
  }
  if (isAmbiguousDiagramRequestFailure(input)) return 'resume_same_attempt'
  if (failure.retryable === true) return 'start_fresh_attempt'
  if (failure.kind === 'http' || failure.kind === 'application') {
    return 'do_not_retry'
  }
  return null
}

/**
 * A reused ambiguous attempt has already reached a terminal response when it
 * explicitly asks for a fresh model run. Exactly one new request is then safe:
 * this helper deliberately rejects initial Generate actions and repeat loops.
 */
export function shouldAutoStartFreshDiagramAttempt(input: {
  submitIntent: ElementGenerationSubmitIntent
  reusedAttempt: boolean
  retryStrategy: TextLabsRetryStrategy | null
  freshAttemptAlreadyStarted: boolean
}): boolean {
  return input.submitIntent === 'retry'
    && input.reusedAttempt
    && input.retryStrategy === 'start_fresh_attempt'
    && !input.freshAttemptAlreadyStarted
}

export interface DiagramFreshAttemptHandoff<T> {
  attemptId: string
  promise: Promise<T>
  createdAtMs: number
  settledAtMs: number | null
}

export type DiagramFreshAttemptHandoffRegistry<T> = Map<
  string,
  DiagramFreshAttemptHandoff<T>
>

export interface DiagramFreshAttemptDecision {
  submitIntentIsRetry: boolean
  reusedAttempt: boolean
  retryStrategy: TextLabsRetryStrategy | null
  policyEligible: boolean
  existingHandoff: boolean
  registryCapacityAvailable: boolean
  backendBudgetMs: number | null
  freshAttemptStarted: boolean
  freshAttemptJoined: boolean
}

function handoffAgeAnchor<T>(handoff: DiagramFreshAttemptHandoff<T>): number {
  return handoff.settledAtMs ?? handoff.createdAtMs
}

function evictOldestSettledDiagramHandoff<T>(
  registry: DiagramFreshAttemptHandoffRegistry<T>,
): boolean {
  const oldestSettled = [...registry.entries()]
    .filter(([, candidate]) => candidate.settledAtMs !== null)
    .sort((left, right) => (
      handoffAgeAnchor(left[1]) - handoffAgeAnchor(right[1])
    ))[0]
  if (!oldestSettled) return false
  registry.delete(oldestSettled[0])
  return true
}

/**
 * Drop expired settled handoffs and enforce a hard registry size ceiling.
 *
 * Callers can inject `nowMs` for deterministic tests. In-flight entries are
 * never evicted: normal insertion refuses to spend G2 when all bounded slots
 * are busy.
 */
export function pruneDiagramFreshAttemptHandoffs<T>(
  registry: DiagramFreshAttemptHandoffRegistry<T>,
  nowMs: number,
  maxEntries = DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES,
): void {
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const safeMaxEntries = Number.isFinite(maxEntries)
    ? Math.max(0, Math.floor(maxEntries))
    : DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES

  for (const [initialAttemptId, handoff] of registry) {
    if (
      handoff.settledAtMs !== null
      && safeNowMs - handoff.settledAtMs >= DIAGRAM_FRESH_ATTEMPT_HANDOFF_TTL_MS
    ) {
      registry.delete(initialAttemptId)
    }
  }

  while (registry.size > safeMaxEntries) {
    if (!evictOldestSettledDiagramHandoff(registry)) break
  }
}

/**
 * Execute one diagram request and, only when an explicit same-attempt
 * reconciliation returns a terminal `start_fresh_attempt`, hand off to one
 * fresh attempt.
 *
 * The optional registry is scoped by the caller (normally one mounted builder
 * hook). Concurrent waiters recovering the same G1 join the same G2 promise.
 * Settled entries remain briefly so a delayed G1 terminal response still joins
 * the already-completed G2. A bounded TTL and size cap prevent a memory leak.
 * Errors from G2 propagate directly and are never caught for another automatic
 * replay.
 */
export async function executeDiagramRequestWithFreshAttemptHandoff<T>(input: {
  submitIntent: ElementGenerationSubmitIntent
  reusedAttempt: boolean
  initialAttemptId: string
  freshAttemptId: string
  send: (attemptId: string, backendDeadlineMs?: number) => Promise<T>
  resolveFreshBackendDeadlineMs: () => number | null
  onFreshAttempt?: (attemptId: string) => void
  onDecision?: (decision: DiagramFreshAttemptDecision) => void
  registry?: DiagramFreshAttemptHandoffRegistry<T>
  now?: () => number
}): Promise<{
  response: T
  attemptId: string
  freshAttemptStarted: boolean
  freshAttemptJoined: boolean
}> {
  try {
    return {
      response: await input.send(input.initialAttemptId),
      attemptId: input.initialAttemptId,
      freshAttemptStarted: false,
      freshAttemptJoined: false,
    }
  } catch (error) {
    const retryStrategy = diagramRetryStrategyForFailure(error)
    const policyEligible = shouldAutoStartFreshDiagramAttempt({
      submitIntent: input.submitIntent,
      reusedAttempt: input.reusedAttempt,
      retryStrategy,
      freshAttemptAlreadyStarted: false,
    })
    const now = input.now ?? Date.now
    const registry = input.registry
    const notifyDecision = (decision: DiagramFreshAttemptDecision) => {
      try {
        input.onDecision?.(decision)
      } catch {
        // Observability must never change request lifecycle semantics.
      }
    }
    if (registry) {
      pruneDiagramFreshAttemptHandoffs(registry, now())
    }
    const existingHandoff = registry?.get(input.initialAttemptId)
    if (!policyEligible) {
      notifyDecision({
        submitIntentIsRetry: input.submitIntent === 'retry',
        reusedAttempt: input.reusedAttempt,
        retryStrategy,
        policyEligible: false,
        existingHandoff: existingHandoff !== undefined,
        registryCapacityAvailable: (
          existingHandoff !== undefined
          || registry === undefined
          || registry.size < DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES
          || [...registry.values()].some(candidate => candidate.settledAtMs !== null)
        ),
        backendBudgetMs: null,
        freshAttemptStarted: false,
        freshAttemptJoined: false,
      })
      throw error
    }

    let handoff = existingHandoff
    if (!handoff) {
      let resolvedBackendBudgetMs: number | null | undefined
      try {
        resolvedBackendBudgetMs = input.resolveFreshBackendDeadlineMs()
      } catch {
        resolvedBackendBudgetMs = null
      }
      const backendBudgetMs = (
        resolvedBackendBudgetMs !== undefined
        && resolvedBackendBudgetMs !== null
        && Number.isFinite(resolvedBackendBudgetMs)
      )
        ? Math.floor(resolvedBackendBudgetMs)
        : null
      if (
        backendBudgetMs === null
        || backendBudgetMs < MINIMUM_FRESH_DIAGRAM_BACKEND_DEADLINE_MS
      ) {
        notifyDecision({
          submitIntentIsRetry: true,
          reusedAttempt: true,
          retryStrategy,
          policyEligible: true,
          existingHandoff: false,
          registryCapacityAvailable: (
            registry === undefined
            || registry.size < DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES
            || [...registry.values()].some(candidate => candidate.settledAtMs !== null)
          ),
          backendBudgetMs,
          freshAttemptStarted: false,
          freshAttemptJoined: false,
        })
        throw error
      }

      if (
        registry
        && registry.size
          >= DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES
      ) {
        evictOldestSettledDiagramHandoff(registry)
      }
      if (
        registry
        && registry.size
          >= DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES
      ) {
        notifyDecision({
          submitIntentIsRetry: true,
          reusedAttempt: true,
          retryStrategy,
          policyEligible: true,
          existingHandoff: false,
          registryCapacityAvailable: false,
          backendBudgetMs,
          freshAttemptStarted: false,
          freshAttemptJoined: false,
        })
        throw error
      }

      const attemptId = input.freshAttemptId
      let startFreshRequest!: () => void
      const startGate = new Promise<void>(resolve => {
        startFreshRequest = resolve
      })
      const promise = startGate.then(() => (
        input.send(attemptId, backendBudgetMs ?? undefined)
      ))
      const createdHandoff: DiagramFreshAttemptHandoff<T> = {
        attemptId,
        promise,
        createdAtMs: now(),
        settledAtMs: null,
      }
      handoff = createdHandoff
      if (registry) {
        registry.set(input.initialAttemptId, createdHandoff)
        const markSettledHandoff = () => {
          if (registry.get(input.initialAttemptId) === createdHandoff) {
            createdHandoff.settledAtMs = now()
          }
        }
        void promise.then(markSettledHandoff, markSettledHandoff)
      }
      notifyDecision({
        submitIntentIsRetry: true,
        reusedAttempt: true,
        retryStrategy,
        policyEligible: true,
        existingHandoff: false,
        registryCapacityAvailable: true,
        backendBudgetMs,
        freshAttemptStarted: true,
        freshAttemptJoined: false,
      })
      startFreshRequest()
    } else {
      notifyDecision({
        submitIntentIsRetry: true,
        reusedAttempt: true,
        retryStrategy,
        policyEligible: true,
        existingHandoff: true,
        registryCapacityAvailable: true,
        backendBudgetMs: null,
        freshAttemptStarted: false,
        freshAttemptJoined: true,
      })
    }

    input.onFreshAttempt?.(handoff.attemptId)
    return {
      response: await handoff.promise,
      attemptId: handoff.attemptId,
      freshAttemptStarted: existingHandoff === undefined,
      freshAttemptJoined: existingHandoff !== undefined,
    }
  }
}

/**
 * Compute the exact downstream budget left after reserving browser cleanup.
 *
 * This raw value is useful for sanitized decision telemetry. Callers must use
 * one of the thresholded helpers (or the fresh-attempt executor) before
 * dispatching paid work.
 */
export function diagramBackendDeadlineBudgetMs(
  browserDeadlineAtMs: number,
  nowMs: number,
): number | null {
  if (!Number.isFinite(browserDeadlineAtMs) || !Number.isFinite(nowMs)) {
    return null
  }
  return Math.floor(browserDeadlineAtMs - nowMs)
    - DIAGRAM_BACKEND_CLEANUP_WINDOW_MS
}

/**
 * Convert the browser's absolute deadline into a validated backend budget.
 *
 * Returning null prevents a paid request from starting when less than the
 * minimum backend budget plus the cleanup window remains.
 */
export function remainingDiagramBackendDeadlineMs(
  browserDeadlineAtMs: number,
  nowMs: number,
  minimumBackendDeadlineMs = MINIMUM_DIAGRAM_BACKEND_DEADLINE_MS,
): number | null {
  if (!Number.isFinite(minimumBackendDeadlineMs)) return null
  const backendDeadlineMs = diagramBackendDeadlineBudgetMs(
    browserDeadlineAtMs,
    nowMs,
  )
  if (backendDeadlineMs === null) return null
  return backendDeadlineMs >= Math.max(0, Math.floor(minimumBackendDeadlineMs))
    ? backendDeadlineMs
    : null
}

/**
 * Preserve a full Text Labs -> Diagram Generator request window for G2.
 */
export function remainingFreshDiagramBackendDeadlineMs(
  browserDeadlineAtMs: number,
  nowMs: number,
): number | null {
  return remainingDiagramBackendDeadlineMs(
    browserDeadlineAtMs,
    nowMs,
    MINIMUM_FRESH_DIAGRAM_BACKEND_DEADLINE_MS,
  )
}
