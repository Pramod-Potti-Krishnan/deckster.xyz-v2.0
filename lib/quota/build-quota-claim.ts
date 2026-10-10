/**
 * Server side of the signed build-quota claim (R-20261007-frontend-15;
 * contract streams/e2e-deck/contracts/F-quota-bq-claim.md v1).
 *
 * `app/api/director/ws-token/route.ts` adds the result as `bq` to the Director
 * WS token it already signs with DIRECTOR_WS_AUTH_SECRET. Flag
 * DECKSTER_WS_BQ_CLAIM_ENABLED (server env, read at runtime, default off):
 * off means the token is exactly what it was before.
 *
 * Everything here is keyed by the user id alone and reads the LIVE database:
 * `User.tier`, the ledger windows (via getQuotaStatus) and
 * `wallet_balance_cents`. It never sees the NextAuth session JWT's tier,
 * approval or wallet, which the browser can rewrite through `update()`
 * (R-20261007-frontend-14).
 */
import { prisma } from '@/lib/prisma'
import { getQuotaStatus, type Tier } from '@/lib/quota/quota'
import {
  buildQuotaClaimFromStatus,
  unverifiedBuildQuotaClaim,
  type BuildQuotaClaim,
} from '@/lib/quota/build-quota'

/** The mint route answers within this budget or the claim is `ok:null`. */
export const BQ_LOOKUP_TIMEOUT_MS = 4000

/**
 * The user's plan as stored in the database right now. A user row that is
 * missing reads as `free` (the same default the quota route uses), which fails
 * closed: free has no included allowance.
 */
export async function readLiveTier(userId: string): Promise<string> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } })
  return row?.tier ?? 'free'
}

/**
 * Compute the claim for one user from the live database. Never throws: a
 * database error or a timeout yields `ok:null, r:"unverified"`, so the mint
 * still succeeds (identity stays available) and Director decides whether to
 * retry at the next `auth_refresh`.
 */
export async function mintBuildQuotaClaim(
  userId: string,
  options: { timeoutMs?: number } = {},
): Promise<BuildQuotaClaim> {
  let tier: string | null = null
  const lookup = (async () => {
    tier = await readLiveTier(userId)
    return buildQuotaClaimFromStatus(await getQuotaStatus(userId, tier as Tier))
  })()

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('build-quota lookup timed out')),
      options.timeoutMs ?? BQ_LOOKUP_TIMEOUT_MS,
    )
  })
  try {
    return await Promise.race([lookup, deadline])
  } catch (error) {
    console.error('[Director WS Auth] live build-quota lookup failed:', error)
    return unverifiedBuildQuotaClaim(tier)
  } finally {
    if (timer) clearTimeout(timer)
  }
}
