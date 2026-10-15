import type { ComposerAdoption } from './composer-theme-policy'

/** Composer library contracts. No credentials or legacy ingest activation. */
export const COMPOSER_READY_KEY_PREFIX = 'deckster_composer_ready_'

export interface ComposerTemplate {
  id: string
  name: string
  slide_count?: number
  stage_template_summary?: { slide_count?: number; schema_version?: string; sha256?: string }
}

export interface ComposerReady {
  composer_adoption?: ComposerAdoption
  session_id: string
  template_id: string
  presentation_id: string
  viewer_url: string
  slide_count?: number
}

export interface ComposerJob {
  job_id: string
  status: string
  stage?: string | null
  template_id?: string | null
  presentation_id?: string | null
  viewer_url?: string | null
  slide_count?: number | null
  session_id?: string
  errors?: string[]
  checkpoint?: { result?: ComposerReady; retryable?: boolean }
  /** Director's job record (TemplateIngestJob) as JSON: the time of its last write, ISO 8601. */
  updated_at?: string | null
  /**
   * Director's orphan watchdog (COMPOSER_STALE_JOB_WATCHDOG_ENABLED, !498): `true` on the poll of a stage job it failed because the process
   * running it is gone ("This job was interrupted by a server restart. Please try again."; `checkpoint.retryable` is true too). Only ever
   * `true` or absent, so a failed job without it is not "not retryable": Director before !498, or with the flag off, never sends it.
   */
  retryable?: boolean
}

/** Explicit UAT or loopback only; never inherit the older production defaults. */
export function requireComposerServiceUrl(value: string | undefined, uatHost: string): string {
  if (!value) throw new Error('Template library service is not configured.')
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(local && url.protocol === 'http:' || url.hostname === uatHost && url.protocol === 'https:' && !url.port)) {
    throw new Error('Template library requires an approved UAT or local service.')
  }
  return url.origin
}

export function validateComposerFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!file.name.toLowerCase().endsWith('.pptx')) return 'Choose a PowerPoint .pptx file.'
  if (!file.size) return 'The presentation is empty.'
  if (file.size > 100 * 1024 * 1024) return 'The presentation must be 100 MB or smaller.'
  return null
}

export function composerReadyResult(job: ComposerJob, expectedSessionId: string): ComposerReady | null {
  if (job.status !== 'complete') return null
  const result = job.checkpoint?.result ?? job
  if (result.session_id !== expectedSessionId || !result.template_id || !result.presentation_id || !result.viewer_url) {
    throw new Error('The completed deck does not belong to the requested session.')
  }
  return {
    composer_adoption: { schema_version: 'composer-adoption-v1', template_id: result.template_id, presentation_id: result.presentation_id, frozen_theme: true },
    session_id: expectedSessionId,
    template_id: result.template_id,
    presentation_id: result.presentation_id,
    viewer_url: result.viewer_url,
    ...(typeof result.slide_count === 'number' ? { slide_count: result.slide_count } : {}),
  }
}

class ComposerRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function composerRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/composer-library/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) {
    const detail = result?.detail
    throw new ComposerRequestError(
      typeof detail === 'string' ? detail : detail?.message || result?.error || 'Template library request failed.',
      response.status,
    )
  }
  return result as T
}

export async function waitForComposerJob(
  jobId: string, signal: AbortSignal, onProgress: (job: ComposerJob) => void,
): Promise<ComposerJob> {
  const pause = () => new Promise<void>((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve() }, 5000)
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) aborted()
  })
  let consecutiveServiceErrors = 0
  for (let attempt = 0; attempt < 360; attempt++) {
    let job: ComposerJob
    try {
      job = await composerRequest<ComposerJob>(`jobs/${encodeURIComponent(jobId)}`, undefined, signal)
      consecutiveServiceErrors = 0
    } catch (error) {
      // The Director proxy can briefly return 502 during an active replay.
      // Keep polling the same job, so a completed deck is never duplicated.
      if (!(error instanceof ComposerRequestError) || ![502, 503, 504].includes(error.status) ||
          ++consecutiveServiceErrors > 3) throw error
      await pause()
      continue
    }
    onProgress(job)
    if (job.status === 'complete') return job
    if (['failed', 'cancelled'].includes(job.status)) throw new Error(job.errors?.join(' ') || 'Template job did not complete.')
    await pause()
  }
  throw new Error('The template job is still running. Reopen the library to check its progress.')
}

// ---- NEXT_PUBLIC_STUDIO_COMPOSER_JOB_RECOVERY (default off; read by the library dialog, never here) --------------------------------------
// The library dialog keeps the job it is waiting for in sessionStorage and resumes it when it opens. A job whose Director process died
// (a redeploy) stays "assembling" or "cracking" for ever, so the dialog waited on it and every action stayed disabled. With the flag on,
// a job that Director reports failed, or whose record stopped moving, ends the wait as a notice with Retry and Dismiss.

/**
 * How long an unfinished job's record may go unwritten before the library calls the job stale: 75 minutes.
 * Director writes a stage job's record only when the job changes state (queued, cracking/assembling, committing, complete/failed); while
 * the Composer worker runs it writes nothing. Director bounds that silent stretch itself: an async worker call (COMPOSER_ASYNC_JOBS_ENABLED,
 * on in UAT since 5 Oct) fails at COMPOSER_ASYNC_JOB_DEADLINE_S (3600 s), a synchronous one at the 900 s request cap, the commit at 600 s.
 * 75 minutes is that 3600 s deadline plus one 900 s request window (the reads before the worker call, the cancel and the failure write, and
 * clock skew). The longest real jobs measured were about 15 minutes (a 30-slide upload) and 7 minutes (a replay), so a live job is never
 * called stale, and a job whose record is older than this cannot still be running.
 * With Director's orphan watchdog on (COMPOSER_STALE_JOB_WATCHDOG_ENABLED, !498, on in UAT) this rule is only a fallback: the running job touches its
 * record every 30 s and Director itself fails an orphan on the first poll after 180 s of silence (`failed`, `retryable: true`), which ends the wait
 * through the failed path above. The library cannot read Director's flag, so the rule stays for a Director without it (flag off, or before !498).
 */
export const COMPOSER_JOB_STALE_AFTER_MS = 75 * 60 * 1000

type RetryTemplate = Pick<ComposerTemplate, 'id' | 'name'>
/** The library action that started a job, with the arguments it was called with, so Retry can run the same action again. */
export type ComposerRetryAction =
  | { action: 'use' | 'ditto'; template: RetryTemplate }
  | { action: 'new-topic'; template: RetryTemplate; brief: string }
  | { action: 'upload' }

/** A job the library stopped waiting for: Director reported it failed (or cancelled), or its record stopped moving (stale). */
export interface ComposerJobRecovery {
  job_id: string
  kind: 'upload' | 'use'
  reason: 'failed' | 'stale'
  /** Director's own error text for a failed job. */
  detail: string | null
  retry: ComposerRetryAction | null
}

/** A stored retry action, checked (sessionStorage is read back as untyped JSON); anything else is null. */
export function composerRetryAction(value: unknown): ComposerRetryAction | null {
  if (!value || typeof value !== 'object') return null
  const { action, template, brief } = value as Record<string, unknown>
  if (action === 'upload') return { action }
  if (!template || typeof template !== 'object') return null
  const { id, name } = template as Record<string, unknown>
  if (typeof id !== 'string' || !id || typeof name !== 'string') return null
  if (action === 'use' || action === 'ditto') return { action, template: { id, name } }
  if (action === 'new-topic' && typeof brief === 'string') return { action, template: { id, name }, brief }
  return null
}

/** The notice for one polled job, or null to keep waiting (a job still moving, a finished job, or a record without a usable time). */
export function composerJobRecovery(
  pending: { job_id: string; kind: 'upload' | 'use'; retry?: unknown }, job: ComposerJob, now: number,
): ComposerJobRecovery | null {
  const base = { job_id: pending.job_id, kind: pending.kind, retry: composerRetryAction(pending.retry) }
  if (['failed', 'cancelled'].includes(job.status)) return { ...base, reason: 'failed', detail: job.errors?.join(' ') || null }
  if (job.status === 'complete') return null
  const written = Date.parse(job.updated_at ?? '')
  if (!Number.isFinite(written) || now - written <= COMPOSER_JOB_STALE_AFTER_MS) return null
  return { ...base, reason: 'stale', detail: null }
}

/** The notice's words. `canRetry` says whether the dialog can run the job's action again here. */
export function composerJobRecoveryMessage(recovery: ComposerJobRecovery, canRetry: boolean): string {
  const upload = recovery.kind === 'upload'
  const lead = recovery.reason === 'stale'
    ? upload ? 'Your last template upload stopped making progress and will not finish.' : 'Your last deck stopped making progress and will not be created.'
    : upload ? 'Your last template upload could not be finished.' : 'Your last deck could not be created.'
  const detail = recovery.detail ? ` ${recovery.detail}` : ''
  const next = canRetry ? '' : upload ? ' Choose the presentation again to upload it.' : ' Choose a template again to start a new deck.'
  return lead + detail + next
}

/** Dismiss: forget the stored job in this tab. Removes `key` only while it still names this job; nothing else, nothing on the server. */
export function dismissComposerJob(storage: Pick<Storage, 'getItem' | 'removeItem'>, key: string, jobId: string): boolean {
  let stored: { job_id?: unknown } | null = null
  try { stored = JSON.parse(storage.getItem(key) || 'null') } catch { return false }
  if (stored?.job_id !== jobId) return false
  storage.removeItem(key)
  return true
}
