/**
 * Template Ingest (C-7): minimal, standalone re-implementation of the
 * Researcher signed-URL upload pipeline used by `hooks/use-file-upload.ts`.
 *
 * Deliberately NOT a refactor of that hook — its behavior must stay
 * byte-identical for the chat paperclip path. This helper runs the same four
 * wire steps (create session → storage-upload-url → signed PUT →
 * process-uploaded) and additionally threads `intent` (e.g. "template_ingest")
 * into process-uploaded so Researcher retains the raw file (contract C-6).
 */

import { apiConfig } from '@/lib/config'

const RESEARCHER_BASE_URL = apiConfig.knowledgeServiceUrl.replace(/\/$/, '')

export interface ResearcherUploadProgress {
  /** 0–100 coarse progress across the four steps. */
  percent: number
  stage: 'session' | 'prepare' | 'upload' | 'process'
}

export interface ResearcherUploadResult {
  researcherSessionId: string
  storagePath: string
  jobId: string | null
  fileName: string
}

export interface ResearcherUploadOptions {
  /** Frontend session id the researcher session is created under. */
  sessionId: string
  userId: string
  file: File
  /** Threaded into process-uploaded (contract C-6), e.g. "template_ingest". */
  intent?: string
  onProgress?: (progress: ResearcherUploadProgress) => void
}

async function readResponseBody(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function getErrorMessage(body: any, fallback: string): string {
  if (!body) return fallback
  if (typeof body === 'string') return body
  if (typeof body.error === 'string') return body.error
  if (typeof body.message === 'string') return body.message
  if (typeof body.detail === 'string') return body.detail
  if (body.detail && typeof body.detail.message === 'string') return body.detail.message
  if (body.detail && typeof body.detail.error_code === 'string') return body.detail.error_code
  return fallback
}

/**
 * Runs ensure-session → storage-upload-url → signed PUT → process-uploaded.
 * Throws Error with a human-readable message on any step failure.
 */
export async function uploadFileToResearcher(options: ResearcherUploadOptions): Promise<ResearcherUploadResult> {
  const { sessionId, userId, file, intent, onProgress } = options

  if (!sessionId) {
    throw new Error('No session id for upload')
  }

  const contentType = file.type || 'application/octet-stream'

  // 1) Ensure a Researcher session exists for this frontend session.
  onProgress?.({ percent: 5, stage: 'session' })
  const sessionResponse = await fetch(`${RESEARCHER_BASE_URL}/api/v1/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId || 'anonymous',
      session_id: sessionId,
      session_name: `Session_${sessionId.slice(0, 8)}`,
      metadata: {
        frontend_session_id: sessionId,
        upload_path: 'direct_supabase',
        ...(intent ? { intent } : {}),
      },
    }),
  })
  const sessionBody = await readResponseBody(sessionResponse)
  if (!sessionResponse.ok) {
    throw new Error(getErrorMessage(sessionBody, `Failed to create Researcher session (${sessionResponse.status})`))
  }
  const researcherSessionId: string = sessionBody?.session_id || sessionId

  // 2) Ask Researcher for a signed storage upload URL.
  onProgress?.({ percent: 20, stage: 'prepare' })
  const prepareResponse = await fetch(`${RESEARCHER_BASE_URL}/api/v1/files/storage-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: researcherSessionId,
      filename: file.name,
      content_type: contentType,
    }),
  })
  const prepareBody = await readResponseBody(prepareResponse)
  if (!prepareResponse.ok) {
    throw new Error(getErrorMessage(prepareBody, `Failed to prepare upload (${prepareResponse.status})`))
  }
  if (!prepareBody?.signed_url || !prepareBody?.storage_path) {
    throw new Error('Researcher did not return a signed upload URL')
  }
  const signedUrl: string = prepareBody.signed_url
  const storagePath: string = prepareBody.storage_path

  // 3) PUT the bytes straight to storage.
  onProgress?.({ percent: 40, stage: 'upload' })
  const putResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!putResponse.ok) {
    const putBody = await readResponseBody(putResponse)
    throw new Error(getErrorMessage(putBody, `Storage upload failed (${putResponse.status})`))
  }

  // 4) Tell Researcher to process the uploaded object (with intent).
  onProgress?.({ percent: 75, stage: 'process' })
  const processResponse = await fetch(`${RESEARCHER_BASE_URL}/api/v1/files/process-uploaded`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: researcherSessionId,
      storage_path: storagePath,
      original_filename: file.name,
      content_type: contentType,
      display_name: file.name,
      ...(intent ? { intent } : {}),
    }),
  })
  const processBody = await readResponseBody(processResponse)
  if (!processResponse.ok && processResponse.status !== 202) {
    throw new Error(getErrorMessage(processBody, `Failed to ingest upload (${processResponse.status})`))
  }

  onProgress?.({ percent: 100, stage: 'process' })

  return {
    researcherSessionId,
    storagePath: processBody?.storage_path || storagePath,
    jobId: processBody?.job_id || null,
    fileName: processBody?.file_name || file.name,
  }
}
