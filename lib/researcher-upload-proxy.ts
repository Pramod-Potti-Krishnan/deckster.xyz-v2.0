/**
 * Researcher upload calls through a same-origin Next proxy (program1/studio-flip-enablers).
 *
 * Today the browser calls the Researcher directly for the three upload steps (sessions/create, files/storage-upload-url,
 * files/process-uploaded) with no credential. With the Researcher's auth flags on those calls need X-API-Key (server-only
 * KNOWLEDGE_API_KEY) and an owner-bound X-Deckster-Session-Token (server-only RESEARCHER_SESSION_TOKEN_SECRET), so they go
 * through /api/researcher/upload/{step}, which checks the chat session owner and adds both headers.
 *
 * Flags (exact "true", default off; both are needed to switch on):
 *   - NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED: the browser switch read here. Off: the URL is the direct Researcher URL, byte for byte.
 *   - STUDIO_RESEARCHER_PROXY_ENABLED: the server route gate (off: the route answers 404 and sends nothing).
 *
 * Client and server safe: only a pure import, no state, the flag is read per call.
 */
import { ingestStatusOwnerKind, type IngestStatusPollIdentity } from '@/lib/researcher-ingest-status-auth'

export const RESEARCHER_UPLOAD_PROXY_PATH = '/api/researcher/upload'

export type ResearcherUploadStep = 'sessions/create' | 'files/storage-upload-url' | 'files/process-uploaded'

/** Proxy step slug -> Researcher path; the server route accepts only these. */
export const RESEARCHER_UPLOAD_STEPS: Record<string, ResearcherUploadStep> = {
  'create-session': 'sessions/create',
  'storage-upload-url': 'files/storage-upload-url',
  'process-uploaded': 'files/process-uploaded',
}

export function isStudioResearcherProxyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED === 'true'
}

/** Server route gate (server env, never exposed to the browser). */
export function isStudioResearcherProxyServerEnabled(): boolean {
  return process.env.STUDIO_RESEARCHER_PROXY_ENABLED === 'true'
}

/**
 * The URL for one upload step. Off: `<researcher>/api/v1/<step>`. On: the same-origin route with the chat session id and the
 * owner kind (email|id; the server reads the actual identity from the signed-in session) in the query.
 */
export function researcherUploadUrl(
  researcherBaseUrl: string,
  step: ResearcherUploadStep,
  identity: IngestStatusPollIdentity | undefined,
): string {
  if (!isStudioResearcherProxyEnabled()) return `${researcherBaseUrl}/api/v1/${step}`
  const slug = Object.keys(RESEARCHER_UPLOAD_STEPS).find(key => RESEARCHER_UPLOAD_STEPS[key] === step) as string
  const query = new URLSearchParams({
    session_id: identity?.sessionId ?? '',
    owner: ingestStatusOwnerKind(identity?.userId),
  })
  return `${RESEARCHER_UPLOAD_PROXY_PATH}/${slug}?${query.toString()}`
}
