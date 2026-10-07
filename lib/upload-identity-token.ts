/**
 * Session token on browser -> Researcher upload calls
 * (R-20261007-frontend-27; contract identity/v1 section 6.4).
 *
 * Flag NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED (exact string "true", default off):
 *   - off: `researcherFetch` is `fetch(url, init)` and nothing else. The request is
 *     the one the code sent before this file existed, byte for byte.
 *   - on:  the call carries `X-Deckster-Session-Token`, obtained for the chat
 *     session id the request already uses from lib/identity-token-client.ts
 *     (cache, refresh at 60% of the lifetime).
 *       * The mint route answers `{ token_enabled: false }`, or the helper has no
 *         token for any other reason: the call goes out with NO header, exactly as
 *         it does today. Tokens being off on the server must never break an upload.
 *       * The Researcher refuses a call that carried a token (401 or 403: it
 *         answers an expired or invalid token with one generic 403, and 401 only
 *         when no credential came, so the body is never read): mint once more and
 *         send that same request once more. A second refusal is
 *         NotYourSessionError; so is a mint route that says the chat session is
 *         not the caller's, at once. Callers show its message through their
 *         existing error path.
 *       * A call that carried no token is answered by the service as it always
 *         was: whatever it says is returned as is.
 *
 * Only the Researcher calls go through here. The signed storage PUT does not
 * (it is not a Researcher call, and a custom header would fail its CORS check).
 * Never logs, and the token lives only in memory inside the helper.
 */
import {
  NotYourSessionError,
  identityTokenClient,
  type IdentityTokenClient,
  type IdentityTokenCredential,
} from '@/lib/identity-token-client'

/** A request init, or a function that makes a fresh one for each attempt (a per-request timeout signal). */
export type ResearcherFetchInit = RequestInit | (() => RequestInit)

/** True when Researcher upload calls must carry the session token (exact string "true"). */
export function isUploadIdentityTokenEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED === 'true'
}

/** True for the typed "not your session" error from the token helper (also across module copies). */
export function isNotYourSessionError(error: unknown): boolean {
  return error instanceof NotYourSessionError
    || (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'session_not_owned')
}

function resolveInit(init: ResearcherFetchInit | undefined): RequestInit | undefined {
  return typeof init === 'function' ? init() : init
}

function withTokenHeader(init: RequestInit | undefined, credential: IdentityTokenCredential | null): RequestInit | undefined {
  if (!credential) return init
  const headers = init?.headers
  if (typeof Headers !== 'undefined' && (headers instanceof Headers || Array.isArray(headers))) {
    const merged = new Headers(headers)
    merged.set(credential.header, credential.token)
    return { ...init, headers: merged }
  }
  return { ...init, headers: { ...(headers as Record<string, string> | undefined), [credential.header]: credential.token } }
}

/** Wait for `promise`, but give up the moment the request's own signal aborts (a hung mint must not outlive the poll timeout). */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error('The operation was aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error('The operation was aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => { signal.removeEventListener('abort', onAbort); resolve(value) },
      error => { signal.removeEventListener('abort', onAbort); reject(error) },
    )
  })
}

/** The token for this session, or null to send the call with no header (as today). */
async function credentialFor(
  client: IdentityTokenClient,
  sessionId: string | null | undefined,
  signal: AbortSignal | null | undefined,
  forceRefresh: boolean,
): Promise<IdentityTokenCredential | null> {
  if (!sessionId) return null
  try {
    return await untilAborted(client.getCredential(sessionId, forceRefresh ? { forceRefresh: true } : undefined), signal)
  } catch (error) {
    // Only "not your session" stops the call. Anything else (the route is down, the
    // login lapsed, no network) leaves the call as it is without the flag; the
    // Researcher answers it as it always has, or refuses it by name.
    if (isNotYourSessionError(error) || signal?.aborted) throw error
    console.warn(`[upload-identity-token] no token for this call (${(error as { code?: string })?.code ?? 'unavailable'})`)
    return null
  }
}

async function fetchWithToken(
  client: IdentityTokenClient,
  sessionId: string | null | undefined,
  url: string,
  init: ResearcherFetchInit | undefined,
): Promise<Response> {
  const first = resolveInit(init)
  const credential = await credentialFor(client, sessionId, first?.signal, false)
  const response = await fetch(url, withTokenHeader(first, credential))

  // With no token on the call the answer is the service's own, whatever it is.
  if (!credential) return response
  if (response.status !== 401 && response.status !== 403) return response

  // The token may simply have expired (an expired or invalid token is a 403): one re-mint,
  // one retry. If the re-mint cannot be had, the Researcher's own answer stands.
  client.invalidate(sessionId as string)
  const second = resolveInit(init)
  // (Only "not your session" or the request's own abort can come out of this; anything else is null.)
  const fresh = await credentialFor(client, sessionId, second?.signal, true)
  if (!fresh) return response
  const retried = await fetch(url, withTokenHeader(second, fresh))
  // Refused again with a fresh token: this session is not the caller's.
  if (retried.status === 401 || retried.status === 403) throw new NotYourSessionError()
  return retried
}

/**
 * `fetch` for one browser -> Researcher call.
 * `sessionId` is the chat session id the request already uses (the id in its
 * body; for a call that has none, the session the job belongs to).
 */
export function researcherFetch(
  sessionId: string | null | undefined,
  url: string,
  init?: ResearcherFetchInit,
  client: IdentityTokenClient = identityTokenClient,
): Promise<Response> {
  // Flag off: the plain fetch, called synchronously with the caller's own arguments.
  if (!isUploadIdentityTokenEnabled()) return fetch(url, resolveInit(init))
  return fetchWithToken(client, sessionId, url, init)
}
