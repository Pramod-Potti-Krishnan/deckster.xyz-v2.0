import type { JWT } from "next-auth/jwt"

/**
 * Server-side handling of the NextAuth client `update()` call
 * (`callbacks.jwt` with `trigger === "update"`).
 *
 * The object a browser passes to `update(data)` is attacker-controlled: it is
 * the JSON body of `POST /api/auth/session`. It must never decide what the
 * server believes about the user's approval, plan or wallet. Behind
 * AUTH_SESSION_UPDATE_SERVER_READ_ENABLED the update step therefore
 *
 *   - accepts only display-only profile fields (name, image) from the client,
 *     with type and length limits, and
 *   - RE-READS approved / tier / walletBalanceCents from the database for the
 *     user the token belongs to.
 *
 * Flag unset or anything other than "true" keeps the previous behaviour
 * exactly (the legacy branch stays in lib/auth-options.ts, untouched).
 *
 * Pure and dependency-free so it can be unit tested without a database: the
 * caller injects the user lookup.
 */

export const SESSION_UPDATE_SERVER_READ_ENV = "AUTH_SESSION_UPDATE_SERVER_READ_ENABLED"

/** Same cap as PATCH /api/profile (MAX_NAME_LENGTH). */
export const SESSION_UPDATE_NAME_MAX = 80
/** Avatar URLs are absolute Supabase public URLs; this also bounds cookie size. */
export const SESSION_UPDATE_IMAGE_MAX = 2048

/** Read at call time (not module load) so a Vercel env change needs no rebuild of this code path. */
export function isSessionUpdateServerReadEnabled(): boolean {
  return process.env[SESSION_UPDATE_SERVER_READ_ENV] === "true"
}

export interface SessionUpdateUserRow {
  approved?: boolean | null
  tier?: string | null
  walletBalanceCents?: number | null
}

export type ReadSessionUser = (userId: string) => Promise<SessionUpdateUserRow | null | undefined>

/**
 * Picks the only client-supplied fields that may reach the token.
 * Anything else on `session` (approved, tier, walletBalanceCents, ...) is dropped.
 */
export function pickClientProfileFields(session: unknown): { name?: string; image?: string } {
  const out: { name?: string; image?: string } = {}
  if (!session || typeof session !== "object") return out
  const raw = session as Record<string, unknown>

  if (typeof raw.name === "string") {
    const name = raw.name.trim()
    if (name.length > 0 && name.length <= SESSION_UPDATE_NAME_MAX) {
      out.name = name
    }
  }

  if (typeof raw.image === "string") {
    const image = raw.image.trim()
    if (image.length > 0 && image.length <= SESSION_UPDATE_IMAGE_MAX && isHttpUrl(image)) {
      out.image = image
    }
  }

  return out
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

/**
 * Applies a client `update()` to the token on the server's terms.
 * Mutates and returns `token`, like the legacy branch.
 *
 * Fail-closed: if the user cannot be resolved or the lookup throws, the token's
 * existing approved / tier / walletBalanceCents are kept as they are (never
 * replaced by a client value).
 */
export async function applyServerReadSessionUpdate(
  token: JWT,
  session: unknown,
  readUser: ReadSessionUser,
): Promise<JWT> {
  const profile = pickClientProfileFields(session)
  if (profile.name !== undefined) token.name = profile.name
  if (profile.image !== undefined) token.picture = profile.image

  const userId = (typeof token.id === "string" && token.id) || (typeof token.sub === "string" && token.sub) || ""
  if (!userId) return token

  try {
    const row = await readUser(userId)
    if (row) {
      // Same normalisation as the sign-in branch of the jwt callback.
      token.approved = row.approved || false
      token.tier = (row.tier || "free") as JWT["tier"]
      token.walletBalanceCents = row.walletBalanceCents ?? 0
    }
  } catch (error) {
    console.error("[Auth] Session update: database re-read failed, keeping existing token claims:", error)
  }

  return token
}
