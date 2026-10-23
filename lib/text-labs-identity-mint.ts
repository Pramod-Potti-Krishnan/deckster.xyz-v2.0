// Text Labs signed requests, Studio's server half (contract: deckster-workspace streams/router/pass3/TL-SIGNED-REQUESTS-CONTRACT.md).
// Server only: the route app/api/identity/text-labs-token/route.ts mints a short-lived token for the signed-in user; the browser only
// ever carries the token. Flag TEXT_LABS_SIGNED_REQUESTS_ENABLED (exact "true", default off) with the secret TEXT_LABS_IDENTITY_SECRET
// (same value as Text Labs' TL_ROUTER_IDENTITY_SECRET, at least 32 bytes). Both are server-only names, never NEXT_PUBLIC_*.
import { createHmac } from 'crypto'

/** Token lifetime. The Text Labs gate refuses a lifetime over 600 s; mint with 540 (contract section 3). */
export const TEXT_LABS_TOKEN_TTL_SECONDS = 540
/** A secret shorter than this (after trimming) is treated as not configured. */
export const TEXT_LABS_SECRET_MIN_BYTES = 32
export const TEXT_LABS_IDENTITY_HEADER = 'X-MR-Identity-Token'

/** Text Labs' subject charset: an opaque DB id. An e-mail (with "@") is refused, never used as a fallback. */
const SUBJECT_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

export function isTextLabsSubject(value: unknown): value is string {
  return typeof value === 'string' && SUBJECT_RE.test(value)
}

/** The flag, read per request from the server environment. */
export function textLabsSignedRequestsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TEXT_LABS_SIGNED_REQUESTS_ENABLED === 'true'
}

/** The secret as Text Labs uses it (raw: it signs with the exact value), or null when it is missing or too short after trimming. */
export function textLabsSigningSecret(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.TEXT_LABS_IDENTITY_SECRET
  if (typeof raw !== 'string') return null
  return Buffer.byteLength(raw.trim(), 'utf8') >= TEXT_LABS_SECRET_MIN_BYTES ? raw : null
}

/** base64url(payload_json) + "." + base64url(HMAC_SHA256(secret, base64url(payload_json))), no padding (contract section 3). */
export function mintTextLabsToken(userId: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = TEXT_LABS_TOKEN_TTL_SECONDS) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: nowSeconds, exp: nowSeconds + ttlSeconds }), 'utf8').toString('base64url')
  const signature = createHmac('sha256', Buffer.from(secret, 'utf8')).update(payload, 'ascii').digest().toString('base64url')
  return { token: `${payload}.${signature}`, expires_at: nowSeconds + ttlSeconds, ttl_seconds: ttlSeconds }
}
