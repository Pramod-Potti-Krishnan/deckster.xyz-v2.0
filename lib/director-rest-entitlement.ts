/**
 * Signed REST entitlement for the Director's user-scoped routes
 * (R-20261007-e2e-deck-17; contract streams/e2e-deck/contracts/F-rest-entitlement.md v1).
 *
 * The Next proxies under app/api/ are the only callers of those Director
 * routes. Each one has already checked the login and derived the user id it puts
 * in the Director path, body or query. This module signs that same id so the
 * Director can tell Deckster's authenticated server proxy from a caller that
 * only knows a user id.
 *
 *   X-Deckster-Entitlement: <payload_b64>.<signature_b64>
 *
 * Both parts are base64url without padding. The payload is compact JSON
 * `{v:1, typ:"rest", sub, iat, exp, m, bq?}` and the signature is
 * HMAC-SHA256 over the literal string "deckster-rest-v1." + payload_b64, keyed
 * with DIRECTOR_WS_AUTH_SECRET (same secret as the Director WS token, a
 * distinct signed message, so a WS token never verifies here and the reverse).
 *
 * Server-only. Rules, all from the contract:
 *  - Mint per request, from the id the proxy already uses for the path/body/
 *    query. Never from client input, never before the proxy's own login check,
 *    never cached or shared across requests or users.
 *  - Never log the header or the secret; never send it to a browser.
 *  - Flag DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED (server env, read on every
 *    call, exact string "true", default off). Off, or no secret, means no
 *    header is added and the outgoing request is exactly what it was before.
 *    An old Director ignores a header it does not know, so the flag can go on
 *    before the Director enforces anything.
 *  - No `sid` claim is ever written: the Director refuses a header that has one.
 */
import { createHmac } from 'crypto'

export const REST_ENTITLEMENT_HEADER = 'X-Deckster-Entitlement'
/** Director refuses a lifetime (exp - iat) over this many seconds. */
export const REST_ENTITLEMENT_TTL_SECONDS = 120
/** The Director refuses a header longer than this many bytes. */
export const REST_ENTITLEMENT_MAX_HEADER_BYTES = 4096
const SIGNING_DOMAIN = 'deckster-rest-v1.'

export interface MintRestEntitlementInput {
  /** The exact user id string the proxy puts in the Director path, body or query. */
  sub: string
  /** HTTP method of the Director call about to be sent (any case). */
  method: string
  /**
   * Signed build-quota claim (F-quota-bq-claim.md), quota routes only
   * (compose, refine, enrich). Omit everywhere else.
   * TODO(F-quota-bq-claim): the three quota proxies do not pass this yet; the
   * claim builder lives in the open WS bq-claim PR (#304, lib/quota/
   * build-quota-claim.ts). Once that lands, pass the live-DB claim there.
   */
  bq?: object | null
  /** Seconds since epoch; tests only. Defaults to now. */
  nowSeconds?: number
}

/** True when the Next proxies should sign Director REST calls. */
export function isRestEntitlementHeaderEnabled(): boolean {
  return process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'
}

/**
 * Build the header value, or null when the secret is unset or the input is not
 * a usable request (empty `sub` or `method`, or a result over the header cap).
 * Does not look at the feature flag; callers use restEntitlementHeaders().
 */
export function mintRestEntitlement(input: MintRestEntitlementInput): string | null {
  const secret = process.env.DIRECTOR_WS_AUTH_SECRET
  if (!secret) return null
  if (typeof input.sub !== 'string' || input.sub === '') return null
  if (typeof input.method !== 'string' || input.method === '') return null

  const iat = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      typ: 'rest',
      sub: input.sub,
      iat,
      exp: iat + REST_ENTITLEMENT_TTL_SECONDS,
      m: input.method.toUpperCase(),
      ...(input.bq ? { bq: input.bq } : {}),
    }),
    'utf8',
  ).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(SIGNING_DOMAIN + payload)
    .digest('base64url')
  const value = `${payload}.${signature}`
  return Buffer.byteLength(value, 'utf8') > REST_ENTITLEMENT_MAX_HEADER_BYTES ? null : value
}

/**
 * The headers to spread into a proxy's Director `fetch`:
 * `{ 'X-Deckster-Entitlement': '<payload>.<sig>' }`, or `{}` when the flag is
 * off, the secret is unset, or minting fails (never throws). `sub` must be the
 * same variable the proxy uses for the Director path/body/query, so the two
 * always match, including for email-keyed users.
 */
export function restEntitlementHeaders(
  sub: string,
  method: string,
  bq?: object | null,
): Record<string, string> {
  if (!isRestEntitlementHeaderEnabled()) return {}
  try {
    const value = mintRestEntitlement({ sub, method, bq })
    return value ? { [REST_ENTITLEMENT_HEADER]: value } : {}
  } catch {
    return {}
  }
}
