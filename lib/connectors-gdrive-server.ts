/**
 * Server-only handlers for /api/connectors/gdrive/* (P4-15 slice 1, DARK). Never import from client components.
 * Researcher owns the tokens; this layer only verifies the session + OAuth state and forwards server-to-server.
 * Owner id is ALWAYS session.user.id (cuid) — never e-mail, never the request body.
 * Tier gate: reuses the Knowledge entitlement (requireKgEntitled) — PENDING PK decision C1.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { requireKgEntitled, kgHeaders } from '@/lib/kg-proxy'
import { requireServiceUrl } from '@/lib/service-url'
import {
  GDRIVE_NONCE_COOKIE, STATE_TTL_MS, buildGoogleAuthUrl, isGdriveConnectorEnabled, newNonce, signState, validateFileIds, verifyState,
} from '@/lib/connectors-gdrive'

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

async function callResearcher(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>, query?: Record<string, string>) {
  const url = new URL(`${researcherBase()}/api/v1/connectors${path}`)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  return fetch(url.toString(), {
    method, cache: 'no-store',
    headers: kgHeaders(body ? { 'Content-Type': 'application/json' } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** Forward a Researcher response but only with whitelisted fields; never pass through anything token-like. */
const TOKEN_KEYS = /token|secret|code|credential/i
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (!TOKEN_KEYS.test(k)) out[k] = scrub(v)
    return out
  }
  return value
}

async function relay(res: Response, keep?: (data: Record<string, unknown>) => Record<string, unknown>) {
  if (!res.ok) return fail(res.status >= 500 ? 502 : res.status, 'Google Drive is not available right now. Please try again.')
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return NextResponse.json(keep ? keep(data) : scrub(data))
}

export async function handleStart(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const clientId = process.env.GOOGLE_CONNECTOR_CLIENT_ID
  const uri = redirectUri()
  if (!clientId || !uri || !stateSecret()) return fail(503, 'Google Drive connection is not set up on this server yet.')
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
    const res = await callResearcher('/gdrive/exchange', 'POST', { owner_id: g.userId, code, redirect_uri: uri })
    return back(res.ok ? 'connected' : 'failed') // response body (and any token in it) is never forwarded to the browser
  } catch (e) {
    console.error('[gdrive] exchange failed:', e instanceof Error ? e.message : 'error')
    return back('failed')
  }
}

export async function handlePickerToken(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  try {
    // Short-lived ACCESS token for the Picker only (drive.file, <1h). Refresh tokens stay in Researcher.
    return await relay(await callResearcher('/gdrive/picker-token', 'POST', { owner_id: g.userId }), d => ({
      access_token: typeof d.access_token === 'string' ? d.access_token : null,
      expires_in: typeof d.expires_in === 'number' ? d.expires_in : null,
    }))
  } catch { return fail(502, 'Google Drive is not available right now. Please try again.') }
}

export async function handleItemsGet(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  try { return await relay(await callResearcher('/gdrive/items', 'GET', undefined, { owner_id: g.userId })) }
  catch { return fail(502, 'Could not load your Drive files. Please try again.') }
}

export async function handleItemsPost(req: Request): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  const body = (await req.json().catch(() => null)) as { file_ids?: unknown } | null
  const ids = validateFileIds(body?.file_ids)
  if (!ids) return fail(400, 'Please choose between 1 and 50 Drive files.')
  try { return await relay(await callResearcher('/gdrive/items', 'POST', { owner_id: g.userId, file_ids: ids })) }
  catch { return fail(502, 'Could not add your Drive files. Please try again.') }
}

export async function handleDisconnect(): Promise<NextResponse> {
  const g = await gate(); if (g.error) return g.error
  try { return await relay(await callResearcher('/gdrive/disconnect', 'POST', { owner_id: g.userId })) }
  catch { return fail(502, 'Could not disconnect Google Drive. Please try again.') }
}
