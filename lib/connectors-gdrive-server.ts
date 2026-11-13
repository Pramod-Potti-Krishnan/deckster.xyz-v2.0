/**
 * Server-only handlers for /api/connectors/gdrive/* (P4-15 slice 1, DARK). Never import from client components.
 * Researcher owns the tokens; this layer only verifies the session + OAuth state and forwards server-to-server.
 * Owner id is ALWAYS session.user.id (cuid) — never e-mail, never the request body.
 * Tier gate: reuses the Knowledge entitlement (requireKgEntitled) — PENDING PK decision C1.
 * Identity: every Researcher call carries the service key (kgHeaders) AND a K-06 token minted with the EXISTING
 * RESEARCHER_SESSION_TOKEN_SECRET (lib/researcher-session-token.ts), sid = "lib:<owner>", uid = owner. No secret → 503, no call.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { requireKgEntitled, kgHeaders } from '@/lib/kg-proxy'
import { requireServiceUrl } from '@/lib/service-url'
import { RESEARCHER_SESSION_TOKEN_HEADER, mintResearcherSessionToken, researcherSessionTokenSecret } from '@/lib/researcher-session-token'
import {
  CONNECTOR_TOKEN_TTL_SECONDS, ITEM_FIELDS, connectorErrorCode, connectorSessionId, pick,
  GDRIVE_NONCE_COOKIE, STATE_TTL_MS, buildGoogleAuthUrl, isGdriveConnectorEnabled, newNonce, signState, validateFileIds, verifyState, MAX_ITEMS_PER_POST,
} from '@/lib/connectors-gdrive'
import { isGdriveSessionLinksEnabled, validChatSessionId, validateLinkedItemIds } from '@/lib/connectors-gdrive-session-links'
import { GDRIVE_RETURN_COOKIE, GDRIVE_RETURN_QUERY, returnRedirectPath, validReturnPath } from '@/lib/connectors-gdrive-composer' // GDRIVE-COMPOSER
import { GDRIVE_MARKER_COOKIE, GDRIVE_MARKER_COOKIE_PATH, GDRIVE_MARKER_MAX_AGE_SECONDS } from '@/lib/connectors-gdrive-composer'
import { validateRemoveItemIds } from '@/lib/connectors-gdrive-remove'

// The flag-off answer: left exactly as it was (no extra header), so a flag-off request reads byte for byte as before.
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })
// Hardening (REVIEW-1 #3): every other connector JSON answer is per user and may never be cached or shared. Only reached with the Drive flag on.
const NO_STORE = { 'Cache-Control': 'no-store' }
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE })

// Hardening (REVIEW-1 #2): a Researcher call gives up after the ingest-status route's upstream timeout (app/api/researcher/ingest-status/[jobId]/route.ts),
// never follows a redirect (it would carry the service key, the K-06 token and, on a 307, the body with the OAuth code), and is read only up to a cap.
export const RESEARCHER_TIMEOUT_MS = 8000
export const RESEARCHER_MAX_BODY_BYTES = 1024 * 1024
class UpstreamUnusable extends Error {}

function researcherBase(): string {
  return requireServiceUrl('Researcher', [{ name: 'KNOWLEDGE_SERVICE_URL', value: process.env.KNOWLEDGE_SERVICE_URL }], { stripTrailingSlash: true })
}
const stateSecret = () => process.env.NEXTAUTH_SECRET ?? ''
function redirectUri(): string | null {
  const base = process.env.NEXTAUTH_URL
  return base ? `${base.replace(/\/+$/, '')}/api/connectors/gdrive/callback` : null
}

type Gate = { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
async function gate(): Promise<Gate> {
  if (!isGdriveConnectorEnabled()) return { error: notFound() }
  const g = await requireKgEntitled() // TODO(C1): connector tier gate pending PK decision; Knowledge entitlement for now
  if (g.error) g.error.headers.set('Cache-Control', 'no-store') // hardening (REVIEW-1 #3): the signed-out / not-entitled answers are no-store too
  return g
}

class IdentityUnavailable extends Error {}

/** K-06 token for this owner, connector-scoped. Throws IdentityUnavailable (fail closed) when the secret is not set. */
function connectorIdentityHeader(ownerId: string): Record<string, string> {
  const secret = researcherSessionTokenSecret()
  const minted = secret ? mintResearcherSessionToken({ secret, sessionId: connectorSessionId(ownerId), userId: ownerId, ttlSeconds: CONNECTOR_TOKEN_TTL_SECONDS }) : null
  if (!minted) throw new IdentityUnavailable('connector identity not configured')
  return { [RESEARCHER_SESSION_TOKEN_HEADER]: minted.token }
}

async function callResearcher(ownerId: string, path: string, method: 'GET' | 'POST' | 'DELETE', body?: Record<string, unknown>, query?: Record<string, string>, identityOverride?: Record<string, string>) {
  const identity = identityOverride ?? connectorIdentityHeader(ownerId)
  const url = new URL(`${researcherBase()}/api/v1/connectors${path}`)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  return fetch(url.toString(), {
    method, cache: 'no-store',
    redirect: 'manual', signal: AbortSignal.timeout(RESEARCHER_TIMEOUT_MS), // hardening (REVIEW-1 #2): a 3xx comes back as itself (an upstream error, below), a wedged call ends
    headers: kgHeaders({ ...(body ? { 'Content-Type': 'application/json' } : {}), ...identity }),
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** Hardening (REVIEW-1 #2): the answer's JSON object, read up to RESEARCHER_MAX_BODY_BYTES (a longer or longer-declared body throws UpstreamUnusable); not a JSON object: {}. */
async function readCapped(res: Response): Promise<Record<string, unknown>> {
  if (Number(res.headers.get('content-length')) > RESEARCHER_MAX_BODY_BYTES) throw new UpstreamUnusable('researcher answer too large')
  const reader = res.body?.getReader()
  if (!reader) return {}
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    bytes += chunk.value.byteLength
    if (bytes > RESEARCHER_MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {})
      throw new UpstreamUnusable('researcher answer too large')
    }
    chunks.push(chunk.value)
  }
  try {
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const notConfigured = () => fail(503, 'Google Drive connection is not set up on this server yet.')

/** Relay a Researcher response through an explicit allow-list only (nothing unlisted ever reaches the browser). */
async function relay(res: Response, keep: (data: Record<string, unknown>) => Record<string, unknown>, failMsg: string) {
  const redirected = res.status >= 300 && res.status < 400 // hardening (REVIEW-1 #2): a redirect is neither followed nor read; it is an upstream error
  const data = redirected ? {} : await readCapped(res)
  if (!res.ok) {
    // Hardening (REVIEW-1 #4): only a Researcher 4xx whose code is on the allow-list keeps its status; any other 4xx, a 3xx and every 5xx are a plain 502,
    // so the composer's 401 / 403 / 404 words are only ever Studio's own refusals (which carry no error_code).
    const code = redirected ? null : connectorErrorCode(data.detail)
    return NextResponse.json({ error: failMsg, error_code: code }, { status: code && res.status >= 400 && res.status < 500 ? res.status : 502, headers: NO_STORE })
  }
  return NextResponse.json(keep(data), { headers: NO_STORE })
}

const listView = (d: Record<string, unknown>) => ({
  connected: d.connected === true,
  account_label: typeof d.account_label === 'string' ? d.account_label : null,
  items: Array.isArray(d.items) ? d.items.map(i => pick(i, ITEM_FIELDS)) : [],
})
const itemsView = (d: Record<string, unknown>) => ({ items: Array.isArray(d.items) ? d.items.map(i => pick(i, ITEM_FIELDS)) : [] })
const disconnectView = (d: Record<string, unknown>) => ({
  disconnected: d.disconnected === true, connected: false,
  provider_revoked: d.provider_revoked === true, content_erased: d.content_erased === true,
  items_marked: typeof d.items_marked === 'number' ? d.items_marked : 0,
})

async function guarded(failMsg: string, fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try { return await fn() } catch (e) {
    if (e instanceof IdentityUnavailable) return notConfigured()
    if ((e as { name?: unknown } | null)?.name === 'TimeoutError') return fail(504, failMsg) // hardening (REVIEW-1 #2): as the ingest-status route, a wedged Researcher is a clean 504
    return fail(502, failMsg)
  }
}

export async function handleStart(req?: Request): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const clientId = process.env.GOOGLE_CONNECTOR_CLIENT_ID
  const uri = redirectUri()
  if (!clientId || !uri || !stateSecret() || !researcherSessionTokenSecret()) return notConfigured()
  // Hardening (REVIEW-1 #7a): the Researcher address and this user's connector identity are checked BEFORE Google is asked, so a misconfigured server says so before consent.
  try { researcherBase(); connectorIdentityHeader(g.userId) } catch { return notConfigured() }
  const nonce = newNonce()
  const res = NextResponse.redirect(buildGoogleAuthUrl(clientId, uri, signState(stateSecret(), g.userId, nonce)))
  res.cookies.set(GDRIVE_NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connectors/gdrive', maxAge: STATE_TTL_MS / 1000 })
  // GDRIVE-COMPOSER: the composer's Connect remembers the chat to come back to (only /builder?session_id=<id>); no ?return= = the Settings landing, as before
  const returnTo = req ? validReturnPath(new URL(req.url).searchParams.get(GDRIVE_RETURN_QUERY)) : null // GDRIVE-COMPOSER
  if (returnTo) res.cookies.set(GDRIVE_RETURN_COOKIE, returnTo, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connectors/gdrive', maxAge: STATE_TTL_MS / 1000 }) // GDRIVE-COMPOSER
  return res
}

export async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const url = new URL(req.url)
  const returnTo = validReturnPath(req.cookies.get(GDRIVE_RETURN_COOKIE)?.value) // GDRIVE-COMPOSER: the chat the composer's Connect started from, if any
  const back = (status: string) => {
    // Hardening (REVIEW-1 #1): going back to a chat carries a one-time random marker, in the address AND in a short-lived cookie only this origin can set;
    // the composer acts on ?gdrive= only when the two match, so a crafted /builder?...&gdrive=connected link does nothing. Not httpOnly: the composer reads it.
    const marker = returnTo ? newNonce() : null
    const res = NextResponse.redirect(new URL(returnTo && marker ? returnRedirectPath(returnTo, status, marker) : `/settings/connectors?gdrive=${status}`, url.origin))
    res.cookies.set(GDRIVE_NONCE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connectors/gdrive', maxAge: 0 })
    if (returnTo) res.cookies.set(GDRIVE_RETURN_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connectors/gdrive', maxAge: 0 }) // GDRIVE-COMPOSER
    if (marker) res.cookies.set(GDRIVE_MARKER_COOKIE, marker, { httpOnly: false, secure: true, sameSite: 'lax', path: GDRIVE_MARKER_COOKIE_PATH, maxAge: GDRIVE_MARKER_MAX_AGE_SECONDS })
    return res
  }
  if (url.searchParams.get('error')) return back('cancelled')
  const check = verifyState(stateSecret(), url.searchParams.get('state'), g.userId, req.cookies.get(GDRIVE_NONCE_COOKIE)?.value)
  if (!check.ok) return back('invalid')
  const code = url.searchParams.get('code'); const uri = redirectUri()
  if (!code || !uri) return back('invalid')
  try {
    const res = await callResearcher(g.userId, '/gdrive/exchange', 'POST', { owner_id: g.userId, code, redirect_uri: uri })
    return back(res.ok ? 'connected' : 'failed') // response body (and any token in it) is never forwarded to the browser
  } catch (e) {
    if (e instanceof IdentityUnavailable) return back('failed')
    console.error('[gdrive] exchange failed:', e instanceof Error ? e.message : 'error')
    return back('failed')
  }
}

export async function handlePickerToken(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const msg = 'Google Drive is not available right now. Please try again.'
  // Short-lived ACCESS token for the Picker only (drive.file, <1h). Refresh tokens stay in Researcher.
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/picker-token', 'POST', { owner_id: g.userId }), d => ({
    access_token: typeof d.access_token === 'string' ? d.access_token : null,
    expires_in: typeof d.expires_in === 'number' ? d.expires_in : null,
  }), msg))
}

export async function handleItemsGet(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const msg = 'Could not load your Drive files. Please try again.'
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/items', 'GET', undefined, { owner_id: g.userId }), listView, msg))
}

export async function handleItemsPost(req: Request): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const body = (await req.json().catch(() => null)) as { file_ids?: unknown } | null
  const ids = validateFileIds(body?.file_ids)
  if (!ids) return fail(400, `Please choose between 1 and ${MAX_ITEMS_PER_POST} Drive files.`)
  const msg = 'Could not add your Drive files. Please try again.'
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/items', 'POST', { owner_id: g.userId, file_ids: ids }), itemsView, msg))
}

export async function handleDisconnect(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const msg = 'Could not disconnect Google Drive. Please try again.'
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/disconnect', 'POST', { owner_id: g.userId }), disconnectView, msg))
}

/** K-06 token scoped to ONE chat session (Researcher _require_chat_session_owner: sid == session_id, uid == owner). */
function chatSessionIdentityHeader(ownerId: string, sessionId: string): Record<string, string> {
  const secret = researcherSessionTokenSecret()
  const minted = secret ? mintResearcherSessionToken({ secret, sessionId, userId: ownerId, ttlSeconds: CONNECTOR_TOKEN_TTL_SECONDS }) : null
  if (!minted) throw new IdentityUnavailable('connector identity not configured')
  return { [RESEARCHER_SESSION_TOKEN_HEADER]: minted.token }
}

const linksView = (d: Record<string, unknown>) => ({
  session_id: typeof d.session_id === 'string' ? d.session_id : null,
  linked: Array.isArray(d.linked) ? d.linked.filter(x => typeof x === 'string') : [],
  unlinked: Array.isArray(d.unlinked) ? d.unlinked.filter(x => typeof x === 'string') : [],
  rejected: Array.isArray(d.rejected) ? d.rejected.map(r => pick(r, ['id', 'error'])) : [],
})

/**
 * Hardening (REVIEW-1 #1): Studio signs "this user owns this chat" only after checking it, as app/api/researcher/ingest-status/[jobId]/route.ts does.
 * No row and someone else's row read the same (404 CONNECTOR_SESSION_NOT_OWNED: a chat's existence is never revealed); a deleted chat is refused (410, same
 * code); a failed lookup is 503. In each case nothing is signed and nothing is sent. Prisma is loaded here, so a flag-off request never loads it.
 * Defence in depth: Researcher also checks its own durable owner record for the chat (research_session_bindings) and answers 403 CONNECTOR_SESSION_NOT_OWNED.
 * (A new chat's Studio row exists before this runs: the composer's "Add from Google Drive" first runs the Builder's own draft-session creator, as the Paperclip does.)
 */
async function ownChatRefusal(ownerId: string, sessionId: string): Promise<NextResponse | null> {
  let chat: { userId: string; status: string } | null
  try {
    const { prisma } = await import('@/lib/prisma')
    chat = await prisma.chatSession.findUnique({ where: { id: sessionId }, select: { userId: true, status: true } })
  } catch {
    return fail(503, 'Could not check this chat right now. Please try again.')
  }
  const refuse = (status: number) => NextResponse.json({ error: "Drive files can't be added to this chat yet.", error_code: 'CONNECTOR_SESSION_NOT_OWNED' }, { status, headers: NO_STORE })
  if (!chat || chat.userId !== ownerId) return refuse(404)
  if (chat.status === 'deleted') return refuse(410)
  return null
}

/** POST = link, DELETE = unlink. Off (either flag): 404. Owner is always the session cuid, and the chat must be the owner's (ownChatRefusal). */
export async function handleSessionLinks(req: Request, method: 'POST' | 'DELETE'): Promise<NextResponse> {
  if (!isGdriveSessionLinksEnabled()) return notFound()
  const g = await gate(); if (g.error) return g.error
  const body = (await req.json().catch(() => null)) as { session_id?: unknown; item_ids?: unknown } | null
  const sessionId = body?.session_id
  const ids = validateLinkedItemIds(body?.item_ids)
  if (!validChatSessionId(sessionId) || !ids || ids.length === 0) return fail(400, 'Please choose between 1 and 25 Drive files for this chat.')
  const refused = await ownChatRefusal(g.userId, sessionId)
  if (refused) return refused
  const msg = method === 'POST' ? 'Could not add your Drive files to this chat. Please try again.' : 'Could not remove your Drive files from this chat. Please try again.'
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/session-links', method,
    { owner_id: g.userId, session_id: sessionId, item_ids: ids }, undefined, chatSessionIdentityHeader(g.userId, sessionId)), linksView, msg))
}

const removeView = (d: Record<string, unknown>) => ({
  removed: Array.isArray(d.removed) ? d.removed.filter(x => typeof x === 'string') : [],
  rejected: Array.isArray(d.rejected) ? d.rejected.map(r => pick(r, ['id', 'error'])) : [],
  content_erased: d.content_erased === true,
})

/**
 * DELETE /api/connectors/gdrive/items {item_ids}: remove library items with a real erase (Researcher !273, its own flag). Drive flag off: 404, no fetch.
 * Owner is always the session cuid (never the body). Researcher fails closed (503 CONNECTOR_ERASE_UNAVAILABLE) when it cannot erase; that surfaces as 502 +
 * error_code, never as a success, and the client tells the user nothing was changed.
 */
export async function handleItemsDelete(req: Request): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const body = (await req.json().catch(() => null)) as { item_ids?: unknown } | null
  const ids = validateRemoveItemIds(body?.item_ids)
  if (!ids) return fail(400, 'Please choose between 1 and 25 Drive files to remove.')
  const msg = "Couldn't remove your Drive files. Nothing was changed. Please try again."
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/items', 'DELETE', { owner_id: g.userId, item_ids: ids }), removeView, msg))
}
