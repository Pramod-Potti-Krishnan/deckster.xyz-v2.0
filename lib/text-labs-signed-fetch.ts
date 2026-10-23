// Text Labs signed requests, the browser half (contract: deckster-workspace streams/router/pass3/TL-SIGNED-REQUESTS-CONTRACT.md).
// Flag NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS (exact "true", default off; build-time), paired with Studio's server flag
// TEXT_LABS_SIGNED_REQUESTS_ENABLED (the mint route). Off: lib/textlabs-client.ts calls the plain fetch exactly as before, with no
// mint call and no header. On: Text Labs' two paid routes (POST /api/chat/message, POST /api/infographic/generate) carry
// X-MR-Identity-Token from Studio's server; the token lives in memory only (never storage, never logged). Import-free, so
// scripts/test-studio-tl-signed-requests.mjs runs it under plain node with fakes.

export const STUDIO_TL_SIGNED_REQUESTS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS === 'true'

export const TL_IDENTITY_HEADER = 'X-MR-Identity-Token'
export const TL_TOKEN_MINT_PATH = '/api/identity/text-labs-token'
/** Mint again when the token has less than this left (contract section 5.1). */
export const TL_TOKEN_REFRESH_MARGIN_MS = 60_000
/** The mint route said {"token_enabled": false}: ask again only after this. */
export const TL_TOKEN_DISABLED_RECHECK_MS = 5 * 60_000
/** A 429's retry_after_seconds is honoured up to this (contract section 5.4). */
export const TL_RATE_LIMIT_MAX_WAIT_MS = 30_000
/** 401 codes that mean "mint again and resend once" (the gate refuses before the handler runs, so a resend has no side effect). */
export const TL_REMINT_CODES: readonly string[] = ['SIGNED_REQUEST_EXPIRED', 'SIGNED_REQUEST_INVALID', 'SIGNED_REQUEST_REQUIRED']

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface TextLabsTokenCache {
  /** The header to add ({} when there is no token: flag off on the server, not signed in, or the mint failed). */
  header(): Promise<Record<string, string>>
  /** Forget the token (a 401 from the gate). */
  invalidate(): void
}

export function createTextLabsTokenCache(deps: { fetchImpl: FetchLike; now?: () => number }): TextLabsTokenCache {
  const now = deps.now ?? Date.now
  let token: string | null = null
  let expiresAtMs = 0
  let disabledUntil = 0
  let minting: Promise<void> | null = null
  const mint = (): Promise<void> => {
    if (minting) return minting // one mint in flight; concurrent callers share it
    minting = (async () => {
      try {
        const response = await deps.fetchImpl(TL_TOKEN_MINT_PATH, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
        const body = response.ok ? await response.json().catch(() => null) : null
        if (body && body.token_enabled === false) {
          token = null
          disabledUntil = now() + TL_TOKEN_DISABLED_RECHECK_MS
          return
        }
        if (!body || typeof body.token !== 'string' || !body.token || typeof body.expires_at !== 'number' || !Number.isFinite(body.expires_at)) {
          token = null // 401 / 503 / a malformed answer: send no header; Text Labs decides (its gate is off until this ships)
          return
        }
        token = body.token
        expiresAtMs = body.expires_at * 1000
      } catch {
        token = null
      } finally {
        minting = null
      }
    })()
    return minting
  }
  return {
    async header() {
      if (now() < disabledUntil) return {}
      if (!token || expiresAtMs - now() < TL_TOKEN_REFRESH_MARGIN_MS) await mint()
      const headers: Record<string, string> = {}
      if (token && expiresAtMs > now()) headers[TL_IDENTITY_HEADER] = token
      return headers
    },
    invalidate() {
      token = null
      expiresAtMs = 0
      disabledUntil = 0
    },
  }
}

/** The gate's error code and retry_after_seconds from a Text Labs error body ({"detail": {...}}), without consuming the response. */
export async function readTextLabsGateError(response: Response): Promise<{ code: string | null; retryAfterSeconds: number | null }> {
  try {
    const body = await response.clone().json()
    const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : null
    const record = detail && typeof detail === 'object' ? detail as Record<string, unknown> : {}
    const code = typeof record.error_code === 'string' ? record.error_code : null
    const wait = typeof record.retry_after_seconds === 'number' && Number.isFinite(record.retry_after_seconds) && record.retry_after_seconds >= 0
      ? record.retry_after_seconds : null
    return { code, retryAfterSeconds: wait }
  } catch {
    return { code: null, retryAfterSeconds: null }
  }
}

const abortError = () => (typeof DOMException === 'function' ? new DOMException('Aborted', 'AbortError') : Object.assign(new Error('Aborted'), { name: 'AbortError' }))

function sleepFor(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const timer = setTimeout(() => { signal?.removeEventListener?.('abort', onAbort); resolve() }, ms)
    const onAbort = () => { clearTimeout(timer); reject(abortError()) }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

/**
 * fetch for Text Labs' two paid routes: adds the token header; on a 401 with a re-mint code, mints again and resends ONCE (same
 * request, so the same X-Generation-Attempt-ID); on a 429 RATE_LIMITED, waits detail.retry_after_seconds (at most 30 s) and resends
 * ONCE. A 503 SIGNED_REQUESTS_NOT_CONFIGURED is returned as it is (a Text Labs fault: no re-mint). Never more than one resend.
 */
export function createTextLabsSignedFetch(deps: {
  fetchImpl: FetchLike
  cache: TextLabsTokenCache
  sleep?: (ms: number, signal?: AbortSignal | null) => Promise<void>
}): (url: string, init?: RequestInit) => Promise<Response> {
  const sleep = deps.sleep ?? sleepFor
  return async (url, init = {}) => {
    const send = async () => deps.fetchImpl(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), ...(await deps.cache.header()) },
    })
    const response = await send()
    if (response.status === 401) {
      const { code } = await readTextLabsGateError(response)
      if (!code || !TL_REMINT_CODES.includes(code)) return response
      deps.cache.invalidate()
      return send()
    }
    if (response.status === 429) {
      const { code, retryAfterSeconds } = await readTextLabsGateError(response)
      if (code !== 'RATE_LIMITED' || retryAfterSeconds === null) return response
      await sleep(Math.min(retryAfterSeconds * 1000, TL_RATE_LIMIT_MAX_WAIT_MS), init.signal)
      return send()
    }
    return response
  }
}

/** detail.error_code of an already-read Text Labs error body, or null. */
export function textLabsGateCode(errorData: unknown): string | null {
  const detail = errorData && typeof errorData === 'object' ? (errorData as { detail?: unknown }).detail : null
  const code = detail && typeof detail === 'object' ? (detail as Record<string, unknown>).error_code : null
  return typeof code === 'string' ? code : null
}

/** What Studio tells the user for a gate refusal that is left after the one resend (null: not a gate code). Never auto-retried. */
export function textLabsGateMessage(code: string | null | undefined): string | null {
  if (!code) return null
  if (TL_REMINT_CODES.includes(code)) return 'Your session could not be verified. Reload the page and try again.'
  if (code === 'SIGNED_REQUESTS_NOT_CONFIGURED') return 'Element generation is unavailable right now. Try again later.'
  if (code === 'RATE_LIMITED') return 'Too many requests right now. Wait a moment and try again.'
  return null
}

let shared: ((url: string, init?: RequestInit) => Promise<Response>) | null = null

/** The page-wide signed fetch (one token cache per tab). Used only with STUDIO_TL_SIGNED_REQUESTS_ENABLED. */
export function textLabsSignedFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!shared) {
    const fetchImpl: FetchLike = (input, options) => fetch(input, options)
    shared = createTextLabsSignedFetch({ fetchImpl, cache: createTextLabsTokenCache({ fetchImpl }) })
  }
  return shared(url, init)
}
