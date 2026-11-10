/**
 * Owner-bound credential for the Researcher ingest-status poll
 * (J6-INGEST-STATUS-AUTH-FE, J6P-5; Researcher MR !235, flag
 * RESEARCHER_INGEST_STATUS_AUTH_ENABLED).
 *
 * With that Researcher flag on, `GET /api/v1/files/ingest-status/{job_id}` answers
 * 401 unless the request carries the session token the Researcher verifies in
 * `X-Deckster-Session-Token`. The signing secret is server-only, so the browser
 * never builds the token: with this flag on, the poll goes through the same-origin
 * route `/api/researcher/ingest-status/{jobId}`, which checks the signed-in user
 * owns the chat session, signs a short-lived token for the Researcher session saved
 * for that chat session, and forwards the poll with the header.
 *
 * Flag NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED (exact string "true",
 * default off):
 *   - off: the poll is the direct, credential-less request it has always been
 *     (same URL, same init), byte for byte.
 *   - on:  the poll goes to the same-origin route. Switching it on needs PK and
 *     RESEARCHER_SESSION_TOKEN_SECRET set on the server (see .env.example).
 *
 * Client and server safe: no imports, no state, the flag is read per call.
 */

/** Same-origin route that attaches the owner-bound token (flag on only). */
export const INGEST_STATUS_PROXY_PATH = '/api/researcher/ingest-status'

/** Which of the signed-in user's own identities the upload used as the Researcher owner. */
export type IngestStatusOwnerKind = 'email' | 'id'

/**
 * What the poll needs, captured when the upload started (never re-read while
 * polling, so opening another deck cannot change what the poll proves):
 * the chat session the file was linked to, and the `user_id` the upload sent
 * to `sessions/create` (the e-mail today, the account id once uploads carry it).
 */
export interface IngestStatusPollIdentity {
  sessionId: string
  userId: string | null | undefined
}

/** True when the poll must carry the owner-bound token (exact string "true"). */
export function isIngestStatusAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED === 'true'
}

/**
 * The owner kind the server should sign, from the value the upload used. Only
 * this one word is sent: the server derives the actual id or e-mail from the
 * signed-in session, so a client can never name an identity of its own.
 * A value with an '@' is the e-mail; anything else is the account id.
 */
export function ingestStatusOwnerKind(userId: string | null | undefined): IngestStatusOwnerKind {
  return typeof userId === 'string' && userId.includes('@') ? 'email' : 'id'
}

/**
 * The URL for one ingest-status poll. The init stays the caller's own
 * (`{ signal }` only): the credential is attached on the server, never here.
 * Flag off: `<researcher>/api/v1/files/ingest-status/<jobId>`, exactly the URL
 * the hook built before this change.
 * Flag on: the same-origin route, with the chat session id and the owner kind
 * in the query (neither is a secret nor an e-mail).
 */
export function ingestStatusPollUrl(
  researcherBaseUrl: string,
  jobId: string,
  identity: IngestStatusPollIdentity | undefined,
): string {
  if (!isIngestStatusAuthEnabled()) {
    return `${researcherBaseUrl}/api/v1/files/ingest-status/${jobId}`
  }
  // No captured identity (the upload always passes one) sends an empty session id,
  // which the route refuses with a 400: the poll never falls back to the direct request.
  const query = new URLSearchParams({
    session_id: identity?.sessionId ?? '',
    owner: ingestStatusOwnerKind(identity?.userId),
  })
  return `${INGEST_STATUS_PROXY_PATH}/${encodeURIComponent(jobId)}?${query.toString()}`
}
