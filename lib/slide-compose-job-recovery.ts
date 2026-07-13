export type SlideComposeJobTerminalStatus = 'building' | 'built' | 'error' | 'cancelled'

export interface SlideComposeJobRecoveryResult {
  job_id: string
  kind: 'compose' | 'refine'
  session_id: string
  presentation_id: string | null
  target_index: number
  status: SlideComposeJobTerminalStatus
  slide_index: number | null
  real_slide_id: string | null
  presentation_url: string | null
  stage: string | null
  errors: string[]
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function optionalIndex(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null
}

export function resolveSlideComposeSessionId(options: {
  deckOwnerSessionId?: string | null
  currentSessionId?: string | null
  wsSessionId?: string | null
}): string {
  return (
    optionalString(options.deckOwnerSessionId)
    ?? optionalString(options.currentSessionId)
    ?? optionalString(options.wsSessionId)
    ?? ''
  )
}

export function buildSlideComposeJobStatusPath(options: {
  jobId: string
  sessionId: string
  presentationId?: string | null
}): string {
  const params = new URLSearchParams({ session_id: options.sessionId })
  if (options.presentationId) params.set('presentation_id', options.presentationId)
  return `/api/slides/jobs/${encodeURIComponent(options.jobId)}?${params.toString()}`
}

export function normalizeSlideComposeJobRecoveryResult(
  value: unknown,
): SlideComposeJobRecoveryResult | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const jobId = optionalString(raw.job_id)
  const sessionId = optionalString(raw.session_id)
  const kind = raw.kind
  const status = raw.status
  if (
    !jobId
    || !sessionId
    || (kind !== 'compose' && kind !== 'refine')
    || (status !== 'building' && status !== 'built' && status !== 'error' && status !== 'cancelled')
  ) {
    return null
  }

  return {
    job_id: jobId,
    kind,
    session_id: sessionId,
    presentation_id: optionalString(raw.presentation_id),
    target_index: optionalIndex(raw.target_index) ?? 0,
    status,
    slide_index: optionalIndex(raw.slide_index),
    real_slide_id: optionalString(raw.real_slide_id),
    presentation_url: optionalString(raw.presentation_url),
    stage: optionalString(raw.stage),
    errors: Array.isArray(raw.errors) ? raw.errors.map(String).filter(Boolean) : [],
  }
}
