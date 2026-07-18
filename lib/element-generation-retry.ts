import type { TextLabsRetryStrategy } from '@/lib/textlabs-client'

export type ElementGenerationSubmitIntent = 'generate' | 'retry'

export interface DiagramRetryCandidate {
  attemptId: string
  requestFingerprint: string
}

export const DIAGRAM_BACKEND_CLEANUP_WINDOW_MS = 10_000
export const MINIMUM_DIAGRAM_BACKEND_DEADLINE_MS = 1_000

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

/**
 * Convert the browser's absolute deadline into a smaller backend budget.
 *
 * Returning null prevents a paid request from starting when less than the
 * minimum backend budget plus the cleanup window remains.
 */
export function remainingDiagramBackendDeadlineMs(
  browserDeadlineAtMs: number,
  nowMs: number,
): number | null {
  if (!Number.isFinite(browserDeadlineAtMs) || !Number.isFinite(nowMs)) return null
  const remainingMs = Math.floor(browserDeadlineAtMs - nowMs)
  const backendDeadlineMs = remainingMs - DIAGRAM_BACKEND_CLEANUP_WINDOW_MS
  return backendDeadlineMs >= MINIMUM_DIAGRAM_BACKEND_DEADLINE_MS
    ? backendDeadlineMs
    : null
}
