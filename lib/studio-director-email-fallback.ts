/**
 * Dual lookup for Director user-owned records across the e-mail -> DB id switch (program1/studio-flip-enablers, DUAL-LOOKUP).
 *
 * With STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED on, a NextAuth session that carries only an e-mail is sent to Director as its DB users-table id
 * (resolveDirectorUserId). Director rows written before the switch (templates, themes, the standard theme, ingest jobs, a chat session's library)
 * are keyed by that e-mail. Reads therefore go DB id first and, ONLY when that finds nothing, once more with the e-mail. Writes are untouched
 * (they keep the DB id).
 *
 * No cross-user read is possible: the e-mail comes from the SERVER session (getServerSession), never from the request; it is used only when the
 * DB says that e-mail's row is exactly the DB id the proxy just sent (the same check directorRestSignHeaders makes), and only when that session has
 * no id of its own (the one case resolveDirectorUserId switched). Director enforces sub == path/query user_id, so the fallback is signed for the
 * e-mail (sub = e-mail), and Director needs no change.
 *
 * Flag off: returns null at once and reads nothing (no session, no DB, no clone of the response), so the proxy answers exactly as before.
 * Any error: null (the primary answer stands). Server-only; never log the header or the secret.
 */
import { mintRestEntitlement, REST_ENTITLEMENT_HEADER } from '@/lib/director-rest-entitlement'
import { dbVerifiedSessionUserId, isStudioDirectorRestSignAllEnabled, type DirectorRestSignDeps } from '@/lib/studio-director-rest-sign'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export type DirectorMiss = (res: Response) => Promise<boolean>

/** A 404 is a miss. */
export const missOnNotFound: DirectorMiss = async res => res.status === 404

/** A 404, or a 200 whose `key` is an empty array / null, is a miss. */
export function missOnEmpty(key: string): DirectorMiss {
  return async res => {
    if (res.status === 404) return true
    if (!res.ok) return false
    try {
      const body = (await res.clone().json()) as Record<string, unknown> | null
      const value = body?.[key]
      return value == null || (Array.isArray(value) && value.length === 0)
    } catch {
      return false
    }
  }
}

/** A 403 (session not owned by the DB id) or a 404 is a miss (Director's library route). */
export const missOnForbiddenOrNotFound: DirectorMiss = async res => res.status === 403 || res.status === 404

async function defaultSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user as { id?: string | null; email?: string | null } | undefined
}

/** The signed-in user's own legacy e-mail key for this call, or null (flag off, session has an id, not switched, DB mismatch, error). */
export async function legacyEmailKey(sentUserId: string, deps: DirectorRestSignDeps = {}): Promise<string | null> {
  if (!isStudioDirectorRestSignAllEnabled()) return null
  try {
    if (typeof sentUserId !== 'string' || !sentUserId) return null
    const user = await (deps.sessionUser ?? defaultSessionUser)()
    if (!user || (typeof user.id === 'string' && user.id)) return null
    const email = typeof user.email === 'string' && user.email ? user.email : null
    if (!email || email === sentUserId) return null
    const verified = await dbVerifiedSessionUserId({ ...deps, sessionUser: async () => user })
    return verified && verified === sentUserId ? email : null
  } catch {
    return null
  }
}

/**
 * The legacy answer to return instead of `primary`, or null to keep `primary`.
 * @param primary    Director's answer for the DB id (not consumed: a miss check reads a clone).
 * @param sentUserId the DB id the primary call sent.
 * @param refetch    the same read for another user id with the given headers.
 * @param isMiss     what "nothing found" means for this route.
 */
export async function directorEmailFallbackRead(
  primary: Response,
  sentUserId: string,
  refetch: (userId: string, headers: Record<string, string>) => Promise<Response>,
  isMiss: DirectorMiss,
  method = 'GET',
  deps: DirectorRestSignDeps = {},
): Promise<Response | null> {
  if (!isStudioDirectorRestSignAllEnabled()) return null
  try {
    if (!(await isMiss(primary))) return null
    const email = await legacyEmailKey(sentUserId, deps)
    if (!email) return null
    const signed = mintRestEntitlement({ sub: email, method })
    const legacy = await refetch(email, signed ? { [REST_ENTITLEMENT_HEADER]: signed } : {})
    if (!legacy.ok || (await isMiss(legacy))) return null
    return legacy
  } catch {
    return null
  }
}
