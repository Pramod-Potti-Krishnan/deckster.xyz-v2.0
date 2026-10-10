/**
 * Server-side mint for the session token the Researcher verifies
 * (J6-INGEST-STATUS-AUTH-FE; Researcher services/session_auth_report.py, K-06 format):
 *
 *   v1.<b64url(sid)>.<b64url(uid)>.<exp>.<b64url(HMAC-SHA256(secret, "sid|uid|exp"))>
 *
 * base64url without padding, `exp` in whole Unix seconds, the HMAC over the literal
 * text `<sid>|<uid>|<exp>` keyed with the configured secret exactly as set (never
 * trimmed or decoded). The two ids travel in the clear because the verifier needs
 * them to recompute the MAC, so a token proves one owner for one Researcher session
 * and nothing else.
 *
 * Server-only. Rules:
 *  - Secret RESEARCHER_SESSION_TOKEN_SECRET: the same value the Researcher uses in
 *    that environment. One shorter than 32 bytes (after trimming) counts as not
 *    configured, because the Researcher refuses the token path below that floor.
 *    Never logged, never sent to a browser, never a NEXT_PUBLIC_ variable.
 *  - Never log a token, a secret, a session id or a user id.
 */
import { createHmac } from 'crypto'

export const RESEARCHER_SESSION_TOKEN_HEADER = 'X-Deckster-Session-Token'
export const RESEARCHER_SESSION_TOKEN_VERSION = 'v1'
export const RESEARCHER_SESSION_TOKEN_MIN_SECRET_BYTES = 32
/** The verifier refuses a token that expires more than 24 h ahead; a poll needs seconds. */
export const RESEARCHER_SESSION_TOKEN_MAX_TTL_SECONDS = 24 * 3600
const MAX_CLAIM_LENGTH = 255

/**
 * The configured signing secret, exactly as set, or null when it is missing or
 * shorter than 32 bytes after trimming (so a placeholder never signs anything).
 */
export function researcherSessionTokenSecret(): string | null {
  const raw = process.env.RESEARCHER_SESSION_TOKEN_SECRET
  if (typeof raw !== 'string') return null
  if (Buffer.byteLength(raw.trim(), 'utf8') < RESEARCHER_SESSION_TOKEN_MIN_SECRET_BYTES) return null
  return raw
}

/**
 * A claim the Researcher verifier accepts: 1-255 characters, printable, no '|'.
 * (Python's str.isprintable: letters, marks, numbers, punctuation, symbols and the
 * ASCII space; no control, format, separator or unassigned characters.)
 */
export function isTokenClaim(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && Array.from(value).length <= MAX_CLAIM_LENGTH
    && !value.includes('|')
    && /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u.test(value)
  )
}

export interface MintResearcherSessionTokenInput {
  secret: string
  /** The Researcher session id the token is for (the one saved for the chat session). */
  sessionId: string
  /** The owner the Researcher bound that session to (the signed-in user's own e-mail or account id). */
  userId: string
  /** Lifetime in seconds, 1 to 24 h. */
  ttlSeconds: number
  /** Seconds since epoch; tests only. Defaults to now. */
  nowSeconds?: number
}

export interface MintedResearcherSessionToken {
  token: string
  /** Unix seconds. */
  expiresAt: number
}

/** Build the token, or null when the secret is empty, a claim is not acceptable or the lifetime is out of range. */
export function mintResearcherSessionToken(
  input: MintResearcherSessionTokenInput,
): MintedResearcherSessionToken | null {
  const { secret, sessionId, userId, ttlSeconds } = input
  if (typeof secret !== 'string' || secret === '') return null
  if (!isTokenClaim(sessionId) || !isTokenClaim(userId)) return null
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > RESEARCHER_SESSION_TOKEN_MAX_TTL_SECONDS) return null

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const exp = now + ttlSeconds
  const mac = createHmac('sha256', secret)
    .update(`${sessionId}|${userId}|${exp}`, 'utf8')
    .digest('base64url')
  const token = [
    RESEARCHER_SESSION_TOKEN_VERSION,
    Buffer.from(sessionId, 'utf8').toString('base64url'),
    Buffer.from(userId, 'utf8').toString('base64url'),
    String(exp),
    mac,
  ].join('.')
  return { token, expiresAt: exp }
}
