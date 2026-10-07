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
 *       * The Researcher answers 401 and its body says the token is expired or
 *         invalid: mint once more and send that same request once more. A second
 *         refusal is returned as is.
 *       * The Researcher answers 403 while a token was on the call, or the mint
 *         route says the chat session is not the caller's: NotYourSessionError,
 *         no retry. Callers show its message through their existing error path.
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

const TOKEN_REFUSAL = /token[\s_-]*(expired|invalid)|(expired|invalid)[\s_-]*token/i

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

async function tokenRefused(response: Response): Promise<boolean> {
  try {
    return TOKEN_REFUSAL.test(await response.clone().text())
  } catch {
    return false
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
  if (response.status === 403) throw new NotYourSessionError()
  if (response.status !== 401 || !(await tokenRefused(response))) return response

  // One re-mint, one retry. A failed re-mint leaves the Researcher's own 401 for the caller.
  client.invalidate(sessionId as string)
  const second = resolveInit(init)
  let fresh: IdentityTokenCredential | null
  try {
    fresh = await credentialFor(client, sessionId, second?.signal, true)
  } catch (error) {
    if (isNotYourSessionError(error)) throw error
    return response
  }
  if (!fresh) return response
  const retried = await fetch(url, withTokenHeader(second, fresh))
  if (retried.status === 403) throw new NotYourSessionError()
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
