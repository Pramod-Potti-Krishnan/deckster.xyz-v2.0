/**
 * DSB-5a: the browser's Researcher upload calls carry a signed session token
 * (K-06 `v1.` format), so that the Researcher's session-create guards
 * (RESEARCHER_HARDENING_V1_ENABLED, RESEARCHER_SESSION_ROUTES_REQUIRE_AUTH_ENABLED)
 * can be switched on without breaking uploads.
 *
 * Flag NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED (exact string "true", default off):
 *   - off: `researcherUploadFetch(fetch, ...)` returns `fetch` itself, so the caller's
 *     `fetch(url, init)` is the call it always was: same arguments, no extra async hop.
 *   - on:  the call carries the token header the mint route names
 *     (RESEARCHER_SESSION_TOKEN_HEADER, lib/researcher-session-token.ts, server side), minted by
 *     GET /api/researcher/session-token for the Researcher session the call names and the owner
 *     the upload sent to sessions/create (its kind only: 'email' or 'id', as the ingest-status
 *     route takes it; the server reads the value from the signed-in session).
 *       * The route answers {token_enabled:false} (flag or secret off on the server), or no
 *         token can be had for another reason (signed out, the route down, no network): the
 *         call goes out with NO header, exactly as today.
 *       * The route says the chat session is not the caller's (403 session_not_owned) or was
 *         deleted (410): the call is not sent; an UploadSessionRefusedError (terminal) is thrown.
 *       * The Researcher refuses a call that carried a token (401 or 403; it answers 401 only
 *         with no credential and one generic 403 for a bad token, so the body is not read):
 *         mint once more and send the same request once more; that answer is returned as is.
 *       * A call that carried no token gets the Researcher's answer as is.
 *
 * Per (session, owner kind): one token, refreshed after 60% of its lifetime; a mint already
 * in flight is shared. The token lives only in memory. Never logs a token, an id or an e-mail.
 * Browser-safe: no crypto, no secret; the only import is the owner-kind rule of
 * lib/researcher-ingest-status-auth.ts (import-free).
 */
import { ingestStatusOwnerKind, isIngestStatusAuthEnabled, type IngestStatusOwnerKind } from '@/lib/researcher-ingest-status-auth'

export const UPLOAD_SESSION_TOKEN_ENDPOINT = '/api/researcher/session-token'
/** Refresh once this fraction of the lifetime has passed. */
export const UPLOAD_SESSION_TOKEN_REFRESH_FRACTION = 0.6
/** After the route says tokens are off, ask again no sooner than this. */
export const UPLOAD_SESSION_TOKEN_DISABLED_RECHECK_MS = 60_000

/** The Researcher session the call names and the owner value the upload sent to sessions/create. */
export interface UploadTokenIdentity {
  sessionId: string | null | undefined
  userId: string | null | undefined
}

export type UploadFetch = (input: string, init?: RequestInit) => Promise<Response>

/** True when the browser's Researcher upload calls carry the session token (exact string "true"). */
export function isUploadSessionTokenEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED === 'true'
}

/** The mint route refused this chat session: not the caller's, or deleted. Terminal: the ingest poll does not retry it. */
export class UploadSessionRefusedError extends Error {
  readonly code: 'session_not_owned' | 'session_deleted'
  readonly status: number
  readonly terminal = true
  constructor(code: 'session_not_owned' | 'session_deleted') {
    super(code === 'session_deleted'
      ? 'This chat session was deleted.'
      : 'This chat session does not belong to your account.')
    this.name = 'UploadSessionRefusedError'
    this.code = code
    this.status = code === 'session_deleted' ? 410 : 403
  }
}

class UploadTokenUnavailableError extends Error {
  readonly code: string
  constructor(code: string) {
    super(`Upload session token unavailable (${code})`)
    this.code = code
  }
}

export interface UploadTokenCredential {
  header: string
  token: string
}

interface CacheEntry {
  credential: UploadTokenCredential
  expiresAtMs: number
  refreshAtMs: number
}

type MintOutcome = { kind: 'disabled' } | { kind: 'token'; entry: CacheEntry }

export interface UploadSessionTokenClient {
  /** The credential, or null when the server has tokens switched off. Throws UploadSessionRefusedError, or another error when none can be had. */
  getCredential(
    fetchImpl: UploadFetch,
    sessionId: string,
    owner: IngestStatusOwnerKind,
    options?: { forceRefresh?: boolean },
  ): Promise<UploadTokenCredential | null>
  /** Forget one token, or all of them. */
  invalidate(sessionId?: string, owner?: IngestStatusOwnerKind): void
}

export function createUploadSessionTokenClient(options: { now?: () => number; endpoint?: string } = {}): UploadSessionTokenClient {
  const now = options.now ?? (() => Date.now())
  const endpoint = options.endpoint ?? UPLOAD_SESSION_TOKEN_ENDPOINT
  const cache = new Map<string, CacheEntry>()
  const inflight = new Map<string, Promise<MintOutcome>>()
  let disabledUntilMs = 0
  const keyOf = (sessionId: string, owner: IngestStatusOwnerKind) => `${owner}\n${sessionId}`

  async function mint(fetchImpl: UploadFetch, sessionId: string, owner: IngestStatusOwnerKind): Promise<MintOutcome> {
    let response: Response
    try {
      const query = new URLSearchParams({ session_id: sessionId, owner })
      response = await fetchImpl(`${endpoint}?${query.toString()}`, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
    } catch {
      throw new UploadTokenUnavailableError('network')
    }
    let body: any = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    if (response.status === 403 && body?.error === 'session_not_owned') throw new UploadSessionRefusedError('session_not_owned')
    if (response.status === 410) throw new UploadSessionRefusedError('session_deleted')
    if (!response.ok) throw new UploadTokenUnavailableError(`status_${response.status}`)
    if (body && body.token_enabled === false) return { kind: 'disabled' }

    const ttlSeconds = Number(body?.ttl_seconds)
    const expiresAtSeconds = Number(body?.expires_at)
    if (
      !body
      || typeof body.token !== 'string' || !body.token
      || typeof body.header !== 'string' || !body.header
      || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0
      || !Number.isFinite(expiresAtSeconds)
    ) {
      throw new UploadTokenUnavailableError('bad_response')
    }
    const receivedAtMs = now()
    return {
      kind: 'token',
      entry: {
        credential: { header: body.header, token: body.token },
        expiresAtMs: expiresAtSeconds * 1000,
        refreshAtMs: receivedAtMs + ttlSeconds * 1000 * UPLOAD_SESSION_TOKEN_REFRESH_FRACTION,
      },
    }
  }

  function mintOnce(fetchImpl: UploadFetch, sessionId: string, owner: IngestStatusOwnerKind): Promise<MintOutcome> {
    const key = keyOf(sessionId, owner)
    const pending = inflight.get(key)
    if (pending) return pending
    const started = mint(fetchImpl, sessionId, owner).finally(() => {
      if (inflight.get(key) === started) inflight.delete(key)
    })
    inflight.set(key, started)
    return started
  }

  async function getCredential(
    fetchImpl: UploadFetch,
    sessionId: string,
    owner: IngestStatusOwnerKind,
    opts: { forceRefresh?: boolean } = {},
  ): Promise<UploadTokenCredential | null> {
    const key = keyOf(sessionId, owner)
    if (!opts.forceRefresh) {
      if (now() < disabledUntilMs) return null
      const cached = cache.get(key)
      if (cached && now() < cached.refreshAtMs) return cached.credential
    }
    const stale = opts.forceRefresh ? undefined : cache.get(key)
    let outcome: MintOutcome
    try {
      outcome = await mintOnce(fetchImpl, sessionId, owner)
    } catch (error) {
      if (error instanceof UploadSessionRefusedError) {
        cache.delete(key)
        throw error
      }
      // A refresh that fails while the old token is still valid keeps the old one.
      if (stale && now() < stale.expiresAtMs) return stale.credential
      throw error
    }
    if (outcome.kind === 'disabled') {
      cache.delete(key)
      disabledUntilMs = now() + UPLOAD_SESSION_TOKEN_DISABLED_RECHECK_MS
      return null
    }
    disabledUntilMs = 0
    cache.set(key, outcome.entry)
    return outcome.entry.credential
  }

  function invalidate(sessionId?: string, owner?: IngestStatusOwnerKind): void {
    if (sessionId === undefined) {
      cache.clear()
      disabledUntilMs = 0
    } else if (owner) {
      cache.delete(keyOf(sessionId, owner))
    } else {
      for (const kind of ['email', 'id'] as const) cache.delete(keyOf(sessionId, kind))
    }
  }

  return { getCredential, invalidate }
}

/** The one client the upload paths share. */
export const uploadSessionTokenClient: UploadSessionTokenClient = createUploadSessionTokenClient()

function withTokenHeader(init: RequestInit | undefined, credential: UploadTokenCredential | null): RequestInit | undefined {
  if (!credential) return init
  const headers = init?.headers
  if (typeof Headers !== 'undefined' && (headers instanceof Headers || Array.isArray(headers))) {
    const merged = new Headers(headers)
    merged.set(credential.header, credential.token)
    return { ...init, headers: merged }
  }
  return { ...init, headers: { ...(headers as Record<string, string> | undefined), [credential.header]: credential.token } }
}

/** Wait for `promise`, but stop waiting the moment the request's own signal aborts (a hung mint must not outlive the poll's timeout). */
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

/** The credential for this call, or null to send it with no header (as today). */
async function credentialFor(
  client: UploadSessionTokenClient,
  fetchImpl: UploadFetch,
  identity: UploadTokenIdentity | undefined,
  signal: AbortSignal | null | undefined,
  forceRefresh: boolean,
): Promise<UploadTokenCredential | null> {
  const sessionId = identity?.sessionId
  if (typeof sessionId !== 'string' || sessionId === '') return null
  try {
    return await untilAborted(
      client.getCredential(fetchImpl, sessionId, ingestStatusOwnerKind(identity?.userId), forceRefresh ? { forceRefresh: true } : undefined),
      signal,
    )
  } catch (error) {
    // Only a refusal from the route, or the request's own abort, stops the call.
    if (error instanceof UploadSessionRefusedError || signal?.aborted) throw error
    const code = error instanceof UploadTokenUnavailableError ? error.code : 'unavailable'
    console.warn(`[upload-session-token] no token for this call (${code})`)
    return null
  }
}

async function fetchWithToken(
  client: UploadSessionTokenClient,
  fetchImpl: UploadFetch,
  identity: UploadTokenIdentity | undefined,
  url: string,
  init: RequestInit | undefined,
): Promise<Response> {
  const signal = init?.signal
  const credential = await credentialFor(client, fetchImpl, identity, signal, false)
  const response = await fetchImpl(url, withTokenHeader(init, credential))
  // No token on the call: the Researcher's answer, whatever it is.
  if (!credential) return response
  if (response.status !== 401 && response.status !== 403) return response
  // The token may simply have expired (an expired or invalid token is a 403): one re-mint, one retry.
  client.invalidate(identity?.sessionId as string, ingestStatusOwnerKind(identity?.userId))
  const fresh = await credentialFor(client, fetchImpl, identity, signal, true)
  if (!fresh) return response
  return fetchImpl(url, withTokenHeader(init, fresh))
}

/**
 * `fetch` for one browser -> Researcher upload call. Call it as
 * `researcherUploadFetch(fetch, { sessionId, userId })(url, init)`.
 * `sessionId` is the Researcher session the call names (the `session_id` in its body; for the
 * ingest-status poll, the job's own session); `userId` is the owner the upload sent to
 * sessions/create (only its kind is sent to the mint route).
 * Flag off: `fetchImpl` itself is returned, so the call is the plain fetch with the caller's own arguments.
 */
export function researcherUploadFetch(
  fetchImpl: UploadFetch,
  identity: UploadTokenIdentity | undefined,
  client: UploadSessionTokenClient = uploadSessionTokenClient,
): UploadFetch {
  if (!isUploadSessionTokenEnabled()) return fetchImpl
  return (url, init) => fetchWithToken(client, fetchImpl, identity, url, init)
}

/**
 * The same, for the ingest-status poll: only the DIRECT poll carries the token. With
 * NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED on, the poll goes to the same-origin proxy,
 * which signs its own token on the server, and `fetchImpl` is returned untouched.
 */
export function researcherUploadPollFetch(
  fetchImpl: UploadFetch,
  identity: UploadTokenIdentity | undefined,
  client: UploadSessionTokenClient = uploadSessionTokenClient,
): UploadFetch {
  if (isIngestStatusAuthEnabled()) return fetchImpl
  return researcherUploadFetch(fetchImpl, identity, client)
}
