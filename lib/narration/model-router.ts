/**
 * Narration's model calls, optionally routed through the Deckster model router.
 *
 * Today `draft.ts` and `tts.ts` call OpenRouter directly with a provider key, so
 * none of narration's spend reaches the router's ledger. Behind
 * `NARRATION_VIA_ROUTER` (server-side, default off) the same three calls go to
 * the router instead: the URL and the headers change, the BODIES do not.
 *
 *   chat   POST {MODEL_ROUTER_URL}/v1/chat/completions   task studio.narration_draft
 *   speech POST {MODEL_ROUTER_URL}/v1/audio/speech       task studio.narration_tts
 *   cost   GET  {MODEL_ROUTER_URL}/v1/generation?id=…
 *
 * Flag off (or on with a router variable missing) is exactly the direct call
 * that was there before: same URL, same headers, same body, and with the flag
 * off the router variables are never read.
 *
 * Going direct after a failed routed call is allowed only where the router
 * provably did no model work, because a second call is a second charge:
 *
 *   - the connection could not be made (refused, unresolved, connect timeout, TLS)
 *   - the router refused the key (401 / 403)
 *   - a 502 / 503 / 504 that carries no `error` object (a proxy answering for a
 *     router that is down; the router's own failures always carry one)
 *
 * Everything else is final: a read timeout, a reset after the request was sent,
 * a 429, any other status. Those may already have reached the provider.
 *
 * Server-only. The key is only ever sent, never logged, and never part of an
 * error message.
 */

import { randomBytes } from 'node:crypto'

export type NarrationTask = 'studio.narration_draft' | 'studio.narration_tts'

/** Where a call was answered. Absent on a result means "direct", as before. */
export type NarrationServedBy = 'router' | 'direct'

/** Who a routed call is for. All optional; an id that is not an opaque id is dropped. */
export interface NarrationCallContext {
  /** The signed-in person's opaque id. Never an e-mail address. */
  userId?: string | null
  /** The Studio session the deck belongs to. */
  sessionId?: string | null
  /** The deck (Layout presentation) the narration is for. */
  presentationId?: string | null
  /** One id per narration job: `trc_` + 12 hex. */
  traceId?: string | null
}

export interface RouterSettings {
  /** The router's base address: no trailing slash, no `/v1`. */
  baseUrl: string
  key: string
}

/** What a direct call sends today. Built by the caller so it stays exactly as it was. */
export interface DirectCall {
  url: string
  init: RequestInit
}

export interface ModelCall {
  router: RouterSettings | null
  /** `/v1/...` on the router. */
  path: string
  /** Null for the cost lookup, which is not a billable call. */
  task: NarrationTask | null
  context?: NarrationCallContext
  /** The request body, sent as given. */
  body?: string
  /** Null when there is no provider key to fall back to. */
  direct: DirectCall | null
  /** Abandon a routed call after this long. */
  timeoutMs: number
}

/** A draft is a short JSON answer; two minutes is far past a healthy one, and the route has 300 s in all. */
export const ROUTER_DRAFT_TIMEOUT_MS = 120_000
/** The billed-cost lookup is best effort and sits inside a render; it must not hold one up. */
export const ROUTER_LOOKUP_TIMEOUT_MS = 10_000
/** Speech may be slow (the Gemini voices take 7 to 18 s to start). The router allows itself 180 s per call; this is
 *  longer, so the router's answer, deadline errors included, arrives before the client gives up. */
export const ROUTER_SPEECH_TIMEOUT_MS = 200_000

const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
const KEY_SHAPE = /^[\x21-\x7e]+$/

/** Connection-phase failures: nothing was sent, so nothing can have been charged. */
const CONNECT_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EADDRNOTAVAIL',
  'UND_ERR_CONNECT_TIMEOUT',
])
const TLS_CODE = /^(CERT_|ERR_TLS_|ERR_SSL_|UNABLE_TO_(GET|VERIFY)_|DEPTH_ZERO_SELF_SIGNED_CERT$|SELF_SIGNED_CERT_IN_CHAIN$)/

const logged = new Set<string>()
function logOnce(id: string, message: string) {
  if (logged.has(id)) return
  logged.add(id)
  console.warn(`[Narration] ${message}`)
}

/** Exactly the string "true". */
export function narrationViaRouterOn(): boolean {
  return process.env.NARRATION_VIA_ROUTER === 'true'
}

/**
 * The router to use, or null for "call OpenRouter directly".
 *
 * Null whenever the flag is off, and the router variables are not even read
 * then. With the flag on and either variable missing or unusable it is null as
 * well, and that is said once in the log (names only, never values).
 */
export function routerSettings(): RouterSettings | null {
  if (!narrationViaRouterOn()) return null
  const baseUrl = routerBase(process.env.MODEL_ROUTER_URL)
  const key = (process.env.MODEL_ROUTER_STUDIO_KEY ?? '').trim()
  // A key with a space or a control character would make fetch throw an error
  // that quotes the header value, so one that is not plain visible text is not used.
  if (!baseUrl || !KEY_SHAPE.test(key)) {
    logOnce(
      'router-unconfigured',
      'NARRATION_VIA_ROUTER is on, but MODEL_ROUTER_URL or MODEL_ROUTER_STUDIO_KEY is missing or unusable; narration calls go straight to OpenRouter.'
    )
    return null
  }
  return { baseUrl, key }
}

function routerBase(raw: string | undefined): string | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  // Origin and path only: credentials, a query or a fragment are not part of a base.
  // The base has no /v1 (the calls add it); one pasted in is dropped rather than doubled.
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '').replace(/\/v1$/, '')
}

/** An opaque id, or null. Starts with a letter or digit, then letters, digits and `._:-`, at most 255. */
export function cleanMrId(value: unknown): string | null {
  return typeof value === 'string' && ID_SHAPE.test(value) ? value : null
}

/** `trc_` + 12 hex. One per narration job (a script run, a render run, one spoken line). */
export function mintNarrationTraceId(): string {
  return `trc_${randomBytes(6).toString('hex')}`
}

/**
 * The identity for one narration job, or undefined when the flag is off (so the
 * flag-off paths carry nothing new). A fresh trace id comes with it.
 */
export function narrationCallContext(
  ids: Pick<NarrationCallContext, 'userId' | 'sessionId' | 'presentationId'>
): NarrationCallContext | undefined {
  if (!narrationViaRouterOn()) return undefined
  return { ...ids, traceId: mintNarrationTraceId() }
}

function routerHeaders(
  router: RouterSettings,
  task: NarrationTask | null,
  context: NarrationCallContext | undefined,
  hasBody: boolean
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (hasBody) headers['Content-Type'] = 'application/json'
  headers.Authorization = `Bearer ${router.key}`
  headers['X-MR-Service'] = 'studio'
  if (task) headers['X-MR-Task'] = task
  const identity: [string, string | null][] = [
    ['X-MR-User-ID', cleanMrId(context?.userId)],
    ['X-MR-Session-ID', cleanMrId(context?.sessionId)],
    ['X-MR-Presentation-ID', cleanMrId(context?.presentationId)],
    ['X-MR-Trace-ID', cleanMrId(context?.traceId)],
  ]
  // A value that is not an opaque id is left out. (The cost lookup passes no context, so it carries none.)
  for (const [name, value] of identity) if (value) headers[name] = value
  return headers
}

/** True for a failure from the connection phase, before any request byte could have been sent. */
export function isConnectFailure(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error
  // fetch wraps the socket error as `cause`; with several addresses that is an AggregateError that still carries the code.
  for (let depth = 0; depth < 4 && current && typeof current === 'object' && !seen.has(current); depth++) {
    seen.add(current)
    const { code, syscall, cause } = current as { code?: unknown; syscall?: unknown; cause?: unknown }
    if (typeof code === 'string') {
      if (CONNECT_CODES.has(code) || TLS_CODE.test(code)) return true
      if (code === 'ETIMEDOUT' && syscall === 'connect') return true
    }
    current = cause
  }
  return false
}

/** Whether a 502 / 503 / 504 body is the router's own error (final) rather than a proxy's. */
function carriesErrorObject(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text)
    const error = parsed && typeof parsed === 'object' ? (parsed as { error?: unknown }).error : undefined
    // An error object is what the router always sends. A non-empty string counts as well: when in doubt, do not pay twice.
    return (typeof error === 'object' && error !== null) || (typeof error === 'string' && error.length > 0)
  } catch {
    return false
  }
}

/** True when the router did no model work and the call may safely go direct. */
async function routerDidNothing(response: Response): Promise<boolean> {
  if (response.status === 401 || response.status === 403) return true
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    try {
      return !carriesErrorObject(await response.clone().text())
    } catch {
      return false
    }
  }
  return false
}

/**
 * Make one narration call: through the router when it is configured, otherwise
 * (or on a safe fallback) straight to OpenRouter.
 *
 * Resolves with the response, which a failed routed call hands back untouched
 * (its body unread) so the caller words the error exactly as it does for a
 * direct call. Rejects with the original error when a routed call fails in a
 * way that is final.
 */
export async function callModel(call: ModelCall): Promise<{ response: Response; servedBy: NarrationServedBy }> {
  const { router, direct } = call
  if (!router) {
    if (!direct) throw new Error('No route is configured for this call')
    return { response: await fetch(direct.url, direct.init), servedBy: 'direct' }
  }

  const goDirect = async (why: string) => {
    logOnce(`fallback-${why}`, `The model router could not take a call (${why}); calling OpenRouter directly.`)
    return { response: await fetch(direct!.url, direct!.init), servedBy: 'direct' as const }
  }

  const init: RequestInit = {
    method: call.body === undefined ? 'GET' : 'POST',
    headers: routerHeaders(router, call.task, call.context, call.body !== undefined),
    signal: AbortSignal.timeout(call.timeoutMs),
  }
  if (call.body !== undefined) init.body = call.body

  let response: Response
  try {
    response = await fetch(`${router.baseUrl}${call.path}`, init)
  } catch (error) {
    if (direct && isConnectFailure(error)) return goDirect('connect error')
    throw error
  }
  if (direct && (await routerDidNothing(response))) {
    // Free the connection; the answer is not wanted.
    void response.body?.cancel().catch(() => undefined)
    return goDirect(`router answered ${response.status}`)
  }
  return { response, servedBy: 'router' }
}
