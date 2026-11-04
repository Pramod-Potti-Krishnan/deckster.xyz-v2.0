/**
 * Sign EVERY Next server proxy that calls a Director user-scoped REST route (program1/studio-director-rest-sign).
 *
 * Director (program1/director-rest-auth, DIRECTOR_REST_AUTH_ALL_ENABLED) enforces X-Deckster-Entitlement on /api/users/** (templates, themes,
 * ingest-jobs), /api/v1/slides/compose-jobs/** (query user_id), compose-one, refine-one, handoff and /sessions/{id}/library. The header format and
 * signer are lib/director-rest-entitlement.ts (claims {v:1, typ:"rest", sub, iat, exp<=iat+120, m}, no sid, HMAC-SHA256 with
 * DIRECTOR_WS_AUTH_SECRET over "deckster-rest-v1." + payload_b64); this module only decides WHEN to sign and WHICH id.
 *
 * Flag STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (server env, read per call, exact "true", default off). Off: returns {} and reads nothing (no session,
 * no DB, no secret), so every request is byte-identical to before. On: the id is DB-verified per request: the NextAuth session user is looked up
 * in the users table (by id, else by e-mail) and the header is minted ONLY when that DB row's id is exactly the id the proxy sends to Director
 * (path / body / query). A mismatch (e.g. an e-mail-keyed fallback), a missing row, a DB error or an unset secret all yield {} (never throws).
 *
 * The verified DB id is cached in-process per session user for VERIFIED_ID_TTL_MS (30 s), so a polling proxy (compose jobs) does not read
 * the DB on every call. Only a found row is cached; a miss, a mismatch or a DB error is read again next time.
 * The Director path of the call is bound in the claims as `path` (Director's verifier, src/utils/rest_entitlement.py, ignores claims it does not read).
 *
 * E-mail fallback: a proxy that sends `sessionUser.id || sessionUser.email` sends the e-mail when the session has no id; the DB id never equals
 * an e-mail, so that call gets NO header (fail-closed) and one log line says so. Director's DIRECTOR_REST_AUTH_ALL_ENABLED must stay off until
 * every session carries an id.
 *
 * Server-only. Never log the header, the secret or the e-mail; never return it to a browser.
 */
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { mintRestEntitlement, REST_ENTITLEMENT_HEADER } from '@/lib/director-rest-entitlement'
import { prisma } from '@/lib/prisma'

export const STUDIO_DIRECTOR_REST_SIGN_ALL_FLAG = 'STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED'

export function isStudioDirectorRestSignAllEnabled(): boolean {
  return process.env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED === 'true'
}

export interface DirectorRestSignDeps {
  /** The signed-in session user ({id?, email?}); defaults to getServerSession(authOptions). */
  sessionUser?: () => Promise<{ id?: string | null; email?: string | null } | null | undefined>
  /** DB lookup of the canonical user id; defaults to prisma.user. */
  findUserId?: (where: { id: string } | { email: string }) => Promise<string | null>
  /** Milliseconds since epoch; tests only. */
  now?: () => number
}

export interface DirectorRestSignOptions extends DirectorRestSignDeps {
  /** The Director path of this call (no host, no query); bound in the claims as `path`. */
  path?: string
}

/** How long a verified DB id is reused for the same session user. */
export const VERIFIED_ID_TTL_MS = 30_000
const verifiedIdCache = new Map<string, { id: string; at: number }>()

/** Tests only: forget every cached id. */
export function clearDirectorRestSignCache(): void {
  verifiedIdCache.clear()
}

async function defaultSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user as { id?: string | null; email?: string | null } | undefined
}

async function defaultFindUserId(where: { id: string } | { email: string }): Promise<string | null> {
  const row = await prisma.user.findUnique({ where, select: { id: true } })
  return row?.id ?? null
}

/** The DB-verified id of a session user, or null; a found id is reused for VERIFIED_ID_TTL_MS. */
async function verifiedIdFor(where: { id: string } | { email: string }, deps: DirectorRestSignDeps): Promise<string | null> {
  const key = 'id' in where ? `id:${where.id}` : `email:${where.email}`
  const now = (deps.now ?? Date.now)()
  const hit = verifiedIdCache.get(key)
  if (hit && now - hit.at < VERIFIED_ID_TTL_MS) return hit.id
  const id = await (deps.findUserId ?? defaultFindUserId)(where)
  if (typeof id === 'string' && id) verifiedIdCache.set(key, { id, at: now })
  else verifiedIdCache.delete(key)
  return id ?? null
}

/** The DB-verified user id of the current session, or null. */
export async function dbVerifiedSessionUserId(deps: DirectorRestSignDeps = {}): Promise<string | null> {
  const user = await (deps.sessionUser ?? defaultSessionUser)()
  if (!user) return null
  if (typeof user.id === 'string' && user.id) return verifiedIdFor({ id: user.id }, deps)
  if (typeof user.email === 'string' && user.email) return verifiedIdFor({ email: user.email }, deps)
  return null
}

/**
 * Headers to spread into a Director REST `fetch`: `{ 'X-Deckster-Entitlement': ... }` or `{}`.
 * @param sentUserId the exact user_id string the proxy sends to Director for this call.
 * @param method     the HTTP method of that Director call.
 * @param options    `path`: the Director path of the call (bound in the claims); the rest is for tests.
 */
export async function directorRestSignHeaders(
  sentUserId: string,
  method: string,
  options: DirectorRestSignOptions = {},
): Promise<Record<string, string>> {
  if (!isStudioDirectorRestSignAllEnabled()) return {}
  try {
    if (typeof sentUserId !== 'string' || !sentUserId) return {}
    const verified = await dbVerifiedSessionUserId(options)
    if (!verified || verified !== sentUserId) {
      if (verified && sentUserId.includes('@')) {
        console.warn('[studio-director-rest-sign] no entitlement header: the session has no user id, so the proxy sent the e-mail fallback (fail-closed; keep Director DIRECTOR_REST_AUTH_ALL_ENABLED off until every session has an id)')
      }
      return {}
    }
    const value = mintRestEntitlement({ sub: sentUserId, method, ...(options.path ? { path: options.path } : {}) })
    return value ? { [REST_ENTITLEMENT_HEADER]: value } : {}
  } catch {
    return {}
  }
}
