/**
 * Browser helper for the session token minted by GET /api/identity/token
 * (R-20261007-frontend-24; contract identity/v1 section 6.4).
 *
 * NOT WIRED IN: nothing in the app imports this yet. Attaching the header to
 * Researcher or Text Labs calls is a follow-up behind its own flag.
 *
 * What it does, per chat session:
 *  - asks the server for a token once and keeps it (one cache entry per session id);
 *  - refreshes it once 60% of its lifetime has passed, so a call never carries a
 *    token near its end (a failed refresh falls back to the cached token while
 *    that one is still valid);
 *  - runs a call with the token header and, if the service answers 401, mints a
 *    fresh token and retries that call exactly once (a second 401 is returned as
 *    is, never looped on);
 *  - turns a 403 (from the mint route or from the service) into a typed
 *    NotYourSessionError, so the UI can say "not your session";
 *  - treats `{ token_enabled: false }` as "no token needed": calls go out with no
 *    header at all, exactly as they do today.
 *
 * It never logs, and the token only ever lives in memory.
 */

export const IDENTITY_TOKEN_ENDPOINT = '/api/identity/token'
/** Refresh once this fraction of the lifetime has passed. */
export const IDENTITY_TOKEN_REFRESH_FRACTION = 0.6
/** After the server says tokens are off, ask again no sooner than this. */
export const IDENTITY_TOKEN_DISABLED_RECHECK_MS = 60_000

export class NotYourSessionError extends Error {
  readonly code = 'session_not_owned'
  readonly status = 403
  constructor() {
    super('This chat session does not belong to your account.')
    this.name = 'NotYourSessionError'
  }
}

export class IdentityTokenUnavailableError extends Error {
  readonly code: string
  readonly status: number | null
  constructor(code: string, status: number | null = null) {
    super(`Identity token unavailable (${code})`)
    this.name = 'IdentityTokenUnavailableError'
    this.code = code
    this.status = status
  }
}

export interface IdentityTokenCredential {
  /** Header name to send, e.g. X-Deckster-Session-Token. */
  header: string
  token: string
}

export interface IdentityTokenClientOptions {
  /** Defaults to the global fetch, looked up at call time. */
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
  /** Milliseconds since epoch; tests only. */
  now?: () => number
  endpoint?: string
}

interface CacheEntry {
  credential: IdentityTokenCredential
  expiresAtMs: number
  refreshAtMs: number
}

export interface IdentityTokenClient {
  /** The credential for this session, or null when the server has tokens switched off. */
  getCredential(sessionId: string, options?: { forceRefresh?: boolean }): Promise<IdentityTokenCredential | null>
  /** Run `send` with the token header; on a 401, mint again and retry once. */
  withToken(
    sessionId: string,
    send: (headers: Record<string, string>) => Promise<Response>,
  ): Promise<Response>
  /** Forget one session's token (or all of them). */
  invalidate(sessionId?: string): void
}

type MintOutcome = { kind: 'disabled' } | { kind: 'token'; entry: CacheEntry }

export function createIdentityTokenClient(options: IdentityTokenClientOptions = {}): IdentityTokenClient {
  const now = options.now ?? (() => Date.now())
  const endpoint = options.endpoint ?? IDENTITY_TOKEN_ENDPOINT
  const send = (url: string, init: RequestInit) => (options.fetchImpl ?? globalThis.fetch)(url, init)

  const cache = new Map<string, CacheEntry>()
  const inflight = new Map<string, Promise<MintOutcome>>()
  let disabledUntilMs = 0

  async function mint(sessionId: string): Promise<MintOutcome> {
    let response: Response
    try {
      response = await send(`${endpoint}?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      })
    } catch {
      throw new IdentityTokenUnavailableError('network')
    }

    if (response.status === 403) throw new NotYourSessionError()
    if (response.status === 401) throw new IdentityTokenUnavailableError('unauthenticated', 401)
    if (response.status === 410) throw new IdentityTokenUnavailableError('session_deleted', 410)
    if (!response.ok) throw new IdentityTokenUnavailableError('unavailable', response.status)

    let body: any = null
    try {
      body = await response.json()
    } catch {
      throw new IdentityTokenUnavailableError('bad_response', response.status)
    }
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
      throw new IdentityTokenUnavailableError('bad_response', response.status)
    }

    // The refresh point is a fraction of the lifetime counted from the moment the
    // token arrived; the hard stop is the token's own `exp`.
    const receivedAtMs = now()
    return {
      kind: 'token',
      entry: {
        credential: { header: body.header, token: body.token },
        expiresAtMs: expiresAtSeconds * 1000,
        refreshAtMs: receivedAtMs + ttlSeconds * 1000 * IDENTITY_TOKEN_REFRESH_FRACTION,
      },
    }
  }

  function mintOnce(sessionId: string): Promise<MintOutcome> {
    const pending = inflight.get(sessionId)
    if (pending) return pending
    const started = mint(sessionId).finally(() => {
      if (inflight.get(sessionId) === started) inflight.delete(sessionId)
    })
    inflight.set(sessionId, started)
    return started
  }

  async function getCredential(
    sessionId: string,
    opts: { forceRefresh?: boolean } = {},
  ): Promise<IdentityTokenCredential | null> {
    if (!sessionId) throw new IdentityTokenUnavailableError('no_session')
    const current = now()

    if (!opts.forceRefresh) {
      if (current < disabledUntilMs) return null
      const cached = cache.get(sessionId)
      if (cached && current < cached.refreshAtMs) return cached.credential
    }

    const stale = opts.forceRefresh ? undefined : cache.get(sessionId)
    let outcome: MintOutcome
    try {
      outcome = await mintOnce(sessionId)
    } catch (error) {
      // A refresh that fails while the old token is still valid is not worth
      // failing the call for; a missing or expired token is.
      if (stale && now() < stale.expiresAtMs && !(error instanceof NotYourSessionError)) {
        return stale.credential
      }
      if (error instanceof NotYourSessionError) cache.delete(sessionId)
      throw error
    }

    if (outcome.kind === 'disabled') {
      cache.delete(sessionId)
      disabledUntilMs = now() + IDENTITY_TOKEN_DISABLED_RECHECK_MS
      return null
    }
    disabledUntilMs = 0
    cache.set(sessionId, outcome.entry)
    return outcome.entry.credential
  }

  async function withToken(
    sessionId: string,
    call: (headers: Record<string, string>) => Promise<Response>,
  ): Promise<Response> {
    const headersFor = (credential: IdentityTokenCredential | null): Record<string, string> => (
      credential ? { [credential.header]: credential.token } : {}
    )

    let credential = await getCredential(sessionId)
    let response = await call(headersFor(credential))

    // One re-mint, only when a token was actually sent and the service refused it.
    if (response.status === 401 && credential) {
      cache.delete(sessionId)
      credential = await getCredential(sessionId, { forceRefresh: true })
      response = await call(headersFor(credential))
    }

    // A 403 means "not your session" only when a token was on the call; with no
    // token (tokens off) the call behaves exactly as it does today.
    if (response.status === 403 && credential) throw new NotYourSessionError()
    return response
  }

  function invalidate(sessionId?: string): void {
    if (sessionId === undefined) {
      cache.clear()
      disabledUntilMs = 0
    } else {
      cache.delete(sessionId)
    }
  }

  return { getCredential, withToken, invalidate }
}

/** Shared instance for app code once it is wired in. */
export const identityTokenClient: IdentityTokenClient = createIdentityTokenClient()
