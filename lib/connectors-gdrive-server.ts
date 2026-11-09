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

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })
const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

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
  return requireKgEntitled() // TODO(C1): connector tier gate pending PK decision; Knowledge entitlement for now
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
    headers: kgHeaders({ ...(body ? { 'Content-Type': 'application/json' } : {}), ...identity }),
    body: body ? JSON.stringify(body) : undefined,
  })
}

const notConfigured = () => fail(503, 'Google Drive connection is not set up on this server yet.')

/** Relay a Researcher response through an explicit allow-list only (nothing unlisted ever reaches the browser). */
async function relay(res: Response, keep: (data: Record<string, unknown>) => Record<string, unknown>, failMsg: string) {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const out = NextResponse.json({ error: failMsg, error_code: connectorErrorCode(data.detail) }, { status: res.status >= 500 ? 502 : res.status })
    return out
  }
  return NextResponse.json(keep(data))
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
    return fail(502, failMsg)
  }
}

export async function handleStart(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const clientId = process.env.GOOGLE_CONNECTOR_CLIENT_ID
  const uri = redirectUri()
  if (!clientId || !uri || !stateSecret() || !researcherSessionTokenSecret()) return notConfigured()
  const nonce = newNonce()
  const res = NextResponse.redirect(buildGoogleAuthUrl(clientId, uri, signState(stateSecret(), g.userId, nonce)))
  res.cookies.set(GDRIVE_NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connectors/gdrive', maxAge: STATE_TTL_MS / 1000 })
  return res
}

export async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const url = new URL(req.url)
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/settings/connectors?gdrive=${status}`, url.origin))
    res.cookies.set(GDRIVE_NONCE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connectors/gdrive', maxAge: 0 })
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

/** POST = link, DELETE = unlink. Off (either flag): 404. Owner is always the session cuid. */
export async function handleSessionLinks(req: Request, method: 'POST' | 'DELETE'): Promise<NextResponse> {
  if (!isGdriveSessionLinksEnabled()) return notFound()
  const g = await gate(); if (g.error) return g.error
  const body = (await req.json().catch(() => null)) as { session_id?: unknown; item_ids?: unknown } | null
  const sessionId = body?.session_id
  const ids = validateLinkedItemIds(body?.item_ids)
  if (!validChatSessionId(sessionId) || !ids || ids.length === 0) return fail(400, 'Please choose between 1 and 25 Drive files for this chat.')
  const msg = method === 'POST' ? 'Could not add your Drive files to this chat. Please try again.' : 'Could not remove your Drive files from this chat. Please try again.'
  return guarded(msg, async () => relay(await callResearcher(g.userId, '/gdrive/session-links', method,
    { owner_id: g.userId, session_id: sessionId, item_ids: ids }, undefined, chatSessionIdentityHeader(g.userId, sessionId)), linksView, msg))
}
