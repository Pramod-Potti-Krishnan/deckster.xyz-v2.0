/**
 * Server-side mint helper for the session token the Researcher verifies
 * (R-20261007-frontend-24; contract identity/v1 section 6, K-06 token format).
 *
 *   v1.<b64url(sid)>.<b64url(uid)>.<exp>.<b64url(HMAC-SHA256(secret, "sid|uid|exp"))>
 *
 * base64url without padding, `exp` in whole Unix seconds, the HMAC taken over the
 * literal text `<sid>|<uid>|<exp>` with the configured secret exactly as set
 * (never trimmed or decoded). It carries the two ids in the clear, because the
 * verifier needs them to recompute the MAC: only a canonical account id and a
 * canonical chat-session id are ever written, never an e-mail address.
 *
 * Server-only. Rules:
 *  - Flag DECKSTER_IDENTITY_TOKEN_ENABLED (exact string "true", read on every
 *    call, default off). Off, or the secret missing, means no token.
 *  - Secret RESEARCHER_SESSION_TOKEN_SECRET: same value as the Researcher's,
 *    per environment. One shorter than 32 bytes (after trimming) counts as
 *    not configured. Never logged, never sent to a browser.
 *  - Never log a token, a secret, a session id or a user id.
 */
import { createHmac } from 'crypto'

export const IDENTITY_TOKEN_HEADER = 'X-Deckster-Session-Token'
export const IDENTITY_TOKEN_VERSION = 'v1'
export const IDENTITY_TOKEN_TTL_SECONDS = 15 * 60
export const IDENTITY_TOKEN_MIN_SECRET_BYTES = 32

/** The platform owner-id shape: ASCII, starts with a letter or digit, 1-255 characters; no '@', no '|'. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

/** True when the mint route may issue tokens (exact string "true"). */
export function isIdentityTokenEnabled(): boolean {
  return process.env.DECKSTER_IDENTITY_TOKEN_ENABLED === 'true'
}

/**
 * The configured signing secret, exactly as set, or null when it is missing or
 * shorter than 32 bytes after trimming (so a placeholder never signs anything).
 */
export function identityTokenSecret(): string | null {
  const raw = process.env.RESEARCHER_SESSION_TOKEN_SECRET
  if (typeof raw !== 'string') return null
  if (Buffer.byteLength(raw.trim(), 'utf8') < IDENTITY_TOKEN_MIN_SECRET_BYTES) return null
  return raw
}

/** A canonical id (account id or chat-session id): safe to put in the token. */
export function isIdentityId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

export interface MintIdentityTokenInput {
  secret: string
  /** The chat session id (ChatSession.id). */
  sessionId: string
  /** The signed-in user's account id (session.user.id). Never an e-mail. */
  userId: string
  /** Seconds since epoch; tests only. Defaults to now. */
  nowSeconds?: number
}

export interface MintedIdentityToken {
  token: string
  /** Unix seconds. */
  expiresAt: number
  ttlSeconds: number
}

/** Build the token, or null when the secret is empty or either id is not canonical. */
export function mintIdentityToken(input: MintIdentityTokenInput): MintedIdentityToken | null {
  const { secret, sessionId, userId } = input
  if (typeof secret !== 'string' || secret === '') return null
  if (!isIdentityId(sessionId) || !isIdentityId(userId)) return null

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const exp = now + IDENTITY_TOKEN_TTL_SECONDS
  const mac = createHmac('sha256', secret)
    .update(`${sessionId}|${userId}|${exp}`, 'utf8')
    .digest('base64url')
  const token = [
    IDENTITY_TOKEN_VERSION,
    Buffer.from(sessionId, 'utf8').toString('base64url'),
    Buffer.from(userId, 'utf8').toString('base64url'),
    String(exp),
    mac,
  ].join('.')
  return { token, expiresAt: exp, ttlSeconds: IDENTITY_TOKEN_TTL_SECONDS }
}
