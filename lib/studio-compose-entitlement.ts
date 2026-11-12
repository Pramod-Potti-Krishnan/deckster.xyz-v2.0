/**
 * Add Slide compose: the signed X-Deckster-Entitlement header for Director's POST /api/v1/slides/compose-one
 * (FRONTEND-2; STUDIO_COMPOSE_ENTITLEMENT_ENABLED, server env, exact "true", default off; stacked on #475).
 *
 * Director !535 (DIRECTOR_ROUTER_COMPOSE_BIND_USER_ENABLED, default off) binds a compose to its user for Model Router attribution ONLY when the
 * request carries a verified X-Deckster-Entitlement whose claim is typ "rest", m "POST" and sub equal to the body's user_id, and sub is also a valid
 * router id as it stands (clean_id(sub) == sub). The body's user_id on its own is never bound. Neither side does anything without the other.
 *
 * This module decides WHETHER the compose proxy may sign; the signing itself is lib/director-rest-entitlement.ts (OPS-2's PR #312, untouched), so
 * the claim is exactly the one the deck-import routes send for a POST: {v:1, typ:"rest", sub, iat, exp, m:"POST"} and no bq claim (the lib's own
 * TODO(F-quota-bq-claim) says the three quota proxies do not pass one yet).
 *
 * The header is minted ONLY when ALL of these hold, and in every other case no header is added and the request is exactly what it was before:
 *  1. STUDIO_COMPOSE_ENTITLEMENT_ENABLED is exactly "true" (read on every call; off, nothing else is read, not even the secret);
 *  2. the body's user_id is the CANONICAL user id: the session user's own id, or the Knowledge-Graph gate's id when that branch runs; never the
 *     e-mail the route falls back to when the session has no id (the route passes that id in as `canonicalUserId`);
 *  3. sub === the body's user_id (the very same string is signed and sent);
 *  4. that string passes Director's clean_id rule, mirrored exactly below;
 *  5. the shared helper's own rules: DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED is exactly "true" and DIRECTOR_WS_AUTH_SECRET is set.
 *
 * Server-only. Never log the header or the secret; never send it to a browser.
 */
import { restEntitlementHeaders } from '@/lib/director-rest-entitlement'

export const STUDIO_COMPOSE_ENTITLEMENT_FLAG = 'STUDIO_COMPOSE_ENTITLEMENT_ENABLED'

/** True when the compose proxy may sign. A server variable read at request time (no NEXT_PUBLIC_ prefix, no rebuild); only the exact string "true". */
export function isStudioComposeEntitlementEnabled(): boolean {
  return process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLED === 'true'
}

/**
 * Director's clean_id rule, mirrored exactly. Source: director-v4.0 src/utils/mr_context.py:84 (`_ID_RE`) and :101-111 (`clean_id`), as of !535
 * (Director commit 4781224, git blob e3f64de4). Director: `_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,254}")`; clean_id returns the value when
 * it is a str and `_ID_RE.fullmatch(value.strip())`, else None; !535 then needs clean_id(sub) == sub.
 *  - anchored at both ends (Python's fullmatch); no `m` flag, so `$` cannot match before a trailing newline;
 *  - no `u` flag and ASCII classes only: a non-ASCII digit or letter never matches;
 *  - Director strips before matching, so a value with surrounding whitespace can never satisfy clean_id(sub) == sub; here whitespace is simply not
 *    in the character classes, so it never matches either (such a value gets no header);
 *  - 1 to 255 characters (a first character, then at most 254 more);
 *  - an e-mail address (`@`) never matches.
 */
export const COMPOSE_ENTITLEMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

export function isComposeEntitlementId(value: unknown): value is string {
  return typeof value === 'string' && COMPOSE_ENTITLEMENT_ID_PATTERN.test(value)
}

/**
 * The headers to spread into the compose proxy's Director `fetch`: `{ 'X-Deckster-Entitlement': '<payload>.<sig>' }`, or `{}` (never throws).
 *
 * @param bodyUserId       the exact string the proxy puts in the body's `user_id`.
 * @param canonicalUserId  the canonical user id the proxy holds (the session user's id, or the KG gate's id); null/undefined when it holds none
 *                         (the body then carries the e-mail fallback). The header is only minted when it equals `bodyUserId`.
 */
export function composeEntitlementHeaders(bodyUserId: string, canonicalUserId: string | null | undefined): Record<string, string> {
  if (!isStudioComposeEntitlementEnabled()) return {}
  try {
    if (typeof canonicalUserId !== 'string' || canonicalUserId === '') return {}
    if (bodyUserId !== canonicalUserId) return {}
    if (!isComposeEntitlementId(bodyUserId)) return {}
    return restEntitlementHeaders(bodyUserId, 'POST')
  } catch {
    return {}
  }
}
