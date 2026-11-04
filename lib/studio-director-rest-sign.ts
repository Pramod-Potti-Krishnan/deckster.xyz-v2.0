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
 * Server-only. Never log the header or the secret; never return it to a browser.
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
}

async function defaultSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user as { id?: string | null; email?: string | null } | undefined
}

async function defaultFindUserId(where: { id: string } | { email: string }): Promise<string | null> {
  const row = await prisma.user.findUnique({ where, select: { id: true } })
  return row?.id ?? null
}

/** The DB-verified user id of the current session, or null. */
export async function dbVerifiedSessionUserId(deps: DirectorRestSignDeps = {}): Promise<string | null> {
  const user = await (deps.sessionUser ?? defaultSessionUser)()
  if (!user) return null
  const find = deps.findUserId ?? defaultFindUserId
  if (typeof user.id === 'string' && user.id) return find({ id: user.id })
  if (typeof user.email === 'string' && user.email) return find({ email: user.email })
  return null
}

/**
 * Headers to spread into a Director REST `fetch`: `{ 'X-Deckster-Entitlement': ... }` or `{}`.
 * @param sentUserId the exact user_id string the proxy sends to Director for this call.
 * @param method     the HTTP method of that Director call.
 */
export async function directorRestSignHeaders(
  sentUserId: string,
  method: string,
  deps: DirectorRestSignDeps = {},
): Promise<Record<string, string>> {
  if (!isStudioDirectorRestSignAllEnabled()) return {}
  try {
    if (typeof sentUserId !== 'string' || !sentUserId) return {}
    const verified = await dbVerifiedSessionUserId(deps)
    if (!verified || verified !== sentUserId) return {}
    const value = mintRestEntitlement({ sub: sentUserId, method })
    return value ? { [REST_ENTITLEMENT_HEADER]: value } : {}
  } catch {
    return {}
  }
}

/**
 * The user id a Director REST proxy sends (and therefore signs).
 *
 * Flag off: exactly the raw id the proxy derived (`session.user.id || session.user.email`), no DB read.
 * Flag on: a session that carries only an e-mail (no `user.id`) is resolved to the DB users-table id for that e-mail, so the
 * id sent in the path / body / query is the same DB id `directorRestSignHeaders` verifies and signs. Sessions that already carry an id,
 * a missing row and a DB error all return the raw id unchanged (the call then goes out unsigned, as before).
 */
export async function resolveDirectorUserId(
  rawUserId: string | null | undefined,
  deps: DirectorRestSignDeps = {},
): Promise<string | null> {
  const raw = typeof rawUserId === 'string' && rawUserId ? rawUserId : null
  if (!raw || !isStudioDirectorRestSignAllEnabled()) return raw
  try {
    const user = await (deps.sessionUser ?? defaultSessionUser)()
    if (!user || (typeof user.id === 'string' && user.id)) return raw
    if (typeof user.email !== 'string' || !user.email || user.email !== raw) return raw
    const dbId = await (deps.findUserId ?? defaultFindUserId)({ email: user.email })
    return dbId || raw
  } catch {
    return raw
  }
}
