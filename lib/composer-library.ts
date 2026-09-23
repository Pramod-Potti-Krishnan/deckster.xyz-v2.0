/** Composer library contracts. No credentials or legacy ingest activation. */
export const COMPOSER_READY_KEY_PREFIX = 'deckster_composer_ready_'

export interface ComposerTemplate {
  id: string
  name: string
  slide_count?: number
  stage_template_summary?: { slide_count?: number; schema_version?: string; sha256?: string }
}

export interface ComposerReady {
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
  checkpoint?: { result?: ComposerReady }
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
    session_id: expectedSessionId,
    template_id: result.template_id,
    presentation_id: result.presentation_id,
    viewer_url: result.viewer_url,
    ...(typeof result.slide_count === 'number' ? { slide_count: result.slide_count } : {}),
  }
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
    throw new Error(typeof detail === 'string' ? detail : detail?.message || result?.error || 'Template library request failed.')
  }
  return result as T
}

export async function waitForComposerJob(
  jobId: string, signal: AbortSignal, onProgress: (job: ComposerJob) => void,
): Promise<ComposerJob> {
  for (let attempt = 0; attempt < 360; attempt++) {
    const job = await composerRequest<ComposerJob>(`jobs/${encodeURIComponent(jobId)}`, undefined, signal)
    onProgress(job)
    if (job.status === 'complete') return job
    if (['failed', 'cancelled'].includes(job.status)) throw new Error(job.errors?.join(' ') || 'Template job did not complete.')
    await new Promise<void>((resolve, reject) => {
      const aborted = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve() }, 5000)
      signal.addEventListener('abort', aborted, { once: true })
      if (signal.aborted) aborted()
    })
  }
  throw new Error('The template job is still running. Reopen the library to check its progress.')
}
