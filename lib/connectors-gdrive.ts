/**
 * P4-15 slice 1: Google Drive picker connector (DARK). Pure helpers, no Next imports, so they can be tested in a vm.
 * Flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED (exact "true", default off). Off: no settings card, every route 404s.
 */
import crypto from 'node:crypto'

export const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const GDRIVE_NONCE_COOKIE = 'deckster_gdrive_oauth_nonce'
export const STATE_TTL_MS = 10 * 60 * 1000
export const MAX_ITEMS_PER_POST = 25 // = Researcher MAX_ITEMS_PER_CALL

export { isGdriveConnectorEnabled } from '@/lib/connectors-gdrive-flag'

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const hmac = (secret: string, data: string) => b64url(crypto.createHmac('sha256', secret).update(data).digest())

export function newNonce(): string {
  return b64url(crypto.randomBytes(24))
}

/** state = payload.sig, payload binds the session user id (cuid) + nonce + expiry. */
export function signState(secret: string, userId: string, nonce: string, now = Date.now()): string {
  if (!secret) throw new Error('state secret missing')
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, n: nonce, e: now + STATE_TTL_MS })))
  return `${payload}.${hmac(secret, payload)}`
}

export type StateCheck = { ok: true } | { ok: false; reason: string }

export function verifyState(secret: string, state: string | null | undefined, sessionUserId: string, cookieNonce: string | null | undefined, now = Date.now()): StateCheck {
  if (!secret) return { ok: false, reason: 'not configured' }
  if (!state || typeof state !== 'string') return { ok: false, reason: 'missing state' }
  const parts = state.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'malformed state' }
  const [payload, sig] = parts
  const expected = hmac(secret, payload)
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad signature' }
  let data: { u?: unknown; n?: unknown; e?: unknown }
  try { data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) } catch { return { ok: false, reason: 'malformed state' } }
  if (typeof data.e !== 'number' || data.e < now) return { ok: false, reason: 'expired' }
  if (data.u !== sessionUserId) return { ok: false, reason: 'user mismatch' }
  if (!cookieNonce || data.n !== cookieNonce) return { ok: false, reason: 'nonce mismatch' }
  return { ok: true }
}

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: GDRIVE_SCOPE,
    access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent', state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/** Drive file ids: URL-safe base64-ish, 10..128 chars. Returns null if any id is invalid. */
export function validateFileIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ITEMS_PER_POST) return null
  const out: string[] = []
  for (const id of input) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(id)) return null
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** K-06 token scope for connector calls: sid = "lib:<owner>", uid = owner (Researcher services/connectors/identity.py). */
export const CONNECTOR_SESSION_PREFIX = 'lib:'
export const CONNECTOR_TOKEN_TTL_SECONDS = 300
export const connectorSessionId = (ownerId: string) => `${CONNECTOR_SESSION_PREFIX}${ownerId}`

/** Item fields relayed to the browser (Researcher routers/connectors.py ITEM_FIELDS). Anything else is dropped. */
export const ITEM_FIELDS = ['id', 'source_ref', 'title', 'mime', 'modified_time', 'url', 'status', 'error', 'job_id'] as const

export function pick(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  const src = value as Record<string, unknown>
  for (const f of fields) {
    const v = src[f]
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[f] = v
  }
  return out
}

/** Researcher error codes Studio may relay as error_code; anything else reads null. */
export const CONNECTOR_ERROR_CODES = [
  'CONNECTOR_IDENTITY_NOT_CONFIGURED', 'CONNECTOR_IDENTITY_REQUIRED', 'CONNECTOR_IDENTITY_INVALID', 'CONNECTOR_OWNER_MISMATCH',
  'CONNECTOR_NOT_CONNECTED', 'CONNECTOR_GRANT_REVOKED', 'CONNECTOR_CRYPTO_UNAVAILABLE', 'CONNECTOR_UPSTREAM_ERROR',
  'CONNECTOR_EXCHANGE_FAILED', 'CONNECTOR_NO_REFRESH_TOKEN',
] as const
export function connectorErrorCode(detail: unknown): string | null {
  return typeof detail === 'string' && (CONNECTOR_ERROR_CODES as readonly string[]).includes(detail) ? detail : null
}
