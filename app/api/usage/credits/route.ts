import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { STUDIO_USAGE_CREDITS_ENABLED, parseUsageCredits, type UsageCreditsErrorCode } from '@/lib/studio-usage-credits'

export const dynamic = 'force-dynamic'

// STUDIO USAGE CREDITS (FRONTEND-2; B62), the server half. GET /api/usage/credits reads the Model Router's usage read API for the SIGNED-IN person and returns the parsed, checked view
// (lib/studio-usage-credits.ts), never the router's body. Contract: streams/router/USAGE-READ-API.md (CODEX-8): GET {MODEL_ROUTER_URL}/v1/usage/user/{user_id}/credits, no query parameters.
//
// Rules:
//   - flag off (NEXT_PUBLIC_STUDIO_USAGE_CREDITS not "true"): 404, before the session is read, as if the route were absent;
//   - session required (401). The router path is built ONLY from session.user.id, URL-encoded: never from a query, a body or a header. A router read key can read ANY person's usage, so this binding is the
//     whole access control; the id the router echoes back must be the same id or the answer is refused;
//   - MODEL_ROUTER_URL (already set for narration) and the new server-only MODEL_ROUTER_USAGE_READ_KEY (a router key with the read scope; never a NEXT_PUBLIC_ name) go only into the router call, the key only into its
//     Authorization header. Either one missing: 503 usage_read_unconfigured, before anything is sent. The key is never in a response, a log or an error message (this file logs nothing);
//   - every answer carries Cache-Control: private, no-store; the router's 401/403, a network failure, malformed JSON and an answer that is not the contract each have their own code and none of them leaks the router's body.
//
// Studio's answer: 200 { ok: true, view } or { ok: false, code, message } with the status below.
//   router 200 valid                         -> 200 view
//   router 200 that is not JSON              -> 502 usage_read_malformed
//   router 200 that is not the contract      -> 502 usage_read_invalid (a missing or malformed field, or another person's id)
//   router 401 / 403                         -> 502 usage_read_refused
//   router 422 invalid_user_id               -> 422 usage_read_user_invalid
//   router 429 router_rate_limited           -> 429 usage_read_rate_limited, Retry-After passed through
//   router 503 plans_unavailable             -> 503 usage_plans_unavailable
//   router 503 credit_store_unavailable      -> 503 usage_credit_store_unavailable
//   any other router answer                  -> 502 usage_read_unavailable
//   no answer (refused, DNS, TLS, timeout)   -> 502 usage_read_network
//   no session                               -> 401 unauthorized
//   URL or key missing                       -> 503 usage_read_unconfigured
//   anything unexpected in this route        -> 500 usage_read_failed

/** Abandon the router call after this long; the chart is a read and must not hold a page up. */
const ROUTER_TIMEOUT_MS = 8000
/** The router's answer is a small document: 31 day rows. Anything past this is not the contract. */
const MAX_BODY_CHARS = 262144
const KEY_SHAPE = /^[\x21-\x7e]{8,512}$/
/** A person's id as a path segment: visible text, 1 to 200 characters, and not "." or ".." (a dot segment would walk out of the path even when encoded). */
const SAFE_USER_ID = /^(?!\.{1,2}$)[^\u0000-\u001f\u007f]{1,200}$/
const RETRY_AFTER = /^\d{1,5}$/

const NO_STORE = 'private, no-store'

const WORDS: Record<UsageCreditsErrorCode, string> = {
  unauthorized: 'Sign in to see your credits.',
  usage_read_unconfigured: 'Credit usage is not switched on yet.',
  usage_read_user_invalid: 'We could not read credits for this account.',
  usage_read_rate_limited: 'Too many requests just now. Try again in a moment.',
  usage_plans_unavailable: 'Plan details are not available right now.',
  usage_credit_store_unavailable: 'The credit balance is not available right now.',
  usage_read_refused: 'Credit usage is not available right now.',
  usage_read_network: 'Credit usage could not be reached.',
  usage_read_malformed: 'Credit usage came back in a form we could not read.',
  usage_read_invalid: 'Credit usage came back in a form we could not read.',
  usage_read_unavailable: 'Credit usage is not available right now.',
  usage_read_failed: 'Credit usage failed to load.',
}

function respond(status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': NO_STORE, ...extraHeaders } })
}

const fail = (status: number, code: UsageCreditsErrorCode, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  respond(status, { ok: false, code, message: WORDS[code], ...extra }, headers)

/** The router's base address from MODEL_ROUTER_URL: http(s) only, origin and path, no trailing slash, no /v1 (the call adds it). Null when empty or not an address. */
function routerBase(raw: string | undefined): string | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  let url: URL
  try { url = new URL(text) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '').replace(/\/v1$/, '')
}

/** The router's `error.code`, or null: only a short plain code is read, and nothing else of its body. */
function routerErrorCode(text: string): string | null {
  try {
    const body: unknown = JSON.parse(text)
    const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null
    const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null
    return typeof code === 'string' && /^[a-z_]{1,48}$/.test(code) ? code : null
  } catch { return null }
}

export async function GET() {
  if (!STUDIO_USAGE_CREDITS_ENABLED) return respond(404, { error: 'Not found' })
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (typeof userId !== 'string' || userId === '') return fail(401, 'unauthorized')

    const base = routerBase(process.env.MODEL_ROUTER_URL)
    const key = (process.env.MODEL_ROUTER_USAGE_READ_KEY ?? '').trim()
    if (!base || !KEY_SHAPE.test(key)) return fail(503, 'usage_read_unconfigured')
    if (!SAFE_USER_ID.test(userId)) return fail(422, 'usage_read_user_invalid')

    let res: Response, text: string
    try {
      res = await fetch(`${base}/v1/usage/user/${encodeURIComponent(userId)}/credits`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
      })
      text = await res.text()
    } catch {
      return fail(502, 'usage_read_network')
    }
    if (text.length > MAX_BODY_CHARS) return fail(502, 'usage_read_malformed')

    if (res.status === 200) {
      let body: unknown
      try { body = JSON.parse(text) } catch { return fail(502, 'usage_read_malformed') }
      const parsed = parseUsageCredits(body, userId)
      return parsed.ok ? respond(200, { ok: true, view: parsed.view }) : fail(502, 'usage_read_invalid')
    }
    if (res.status === 401 || res.status === 403) return fail(502, 'usage_read_refused')
    if (res.status === 429) {
      const wait = (res.headers.get('Retry-After') ?? '').trim()
      return RETRY_AFTER.test(wait)
        ? fail(429, 'usage_read_rate_limited', { retryAfterSeconds: Number(wait) }, { 'Retry-After': wait })
        : fail(429, 'usage_read_rate_limited')
    }
    const code = routerErrorCode(text)
    if (res.status === 422 && code === 'invalid_user_id') return fail(422, 'usage_read_user_invalid')
    if (res.status === 503 && code === 'plans_unavailable') return fail(503, 'usage_plans_unavailable')
    if (res.status === 503 && code === 'credit_store_unavailable') return fail(503, 'usage_credit_store_unavailable')
    return fail(502, 'usage_read_unavailable')
  } catch {
    return fail(500, 'usage_read_failed')
  }
}
