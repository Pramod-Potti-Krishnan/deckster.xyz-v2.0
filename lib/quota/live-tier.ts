/**
 * The tier Studio's quota routes use (R-20261007-frontend-19, J8.1).
 *
 * Flag DECKSTER_QUOTA_LIVE_TIER_ENABLED (lib/quota/live-tier-flag.ts), default off.
 *
 * Off: the session JWT's tier, untouched. The JWT is unforgeable after
 * #300/#301 but is only refreshed at sign-in or `update()`, so it can lag the
 * database for up to its 30-day life.
 *
 * On: the user's plan as stored right now (`readLiveTier`, the same read the
 * signed build-quota claim uses), so Studio's gate, `/api/usage/quota`,
 * `/api/wallet/debit` and the Director claim agree. A missing tier reads as
 * `free`, which has no included allowance (fails closed, like the claim).
 *
 * If the live read throws, the session tier is used and the failure is logged:
 * fail-open exactly as these routes behave today. It is not a refusal because
 * (a) the very next read the routes make is the quota picture from the same
 * database, so a database that is really down fails there as it always did, and
 * (b) the debit route must never lose a turn's accounting ("Director already
 * completed this turn"). The claim's own `ok:null` is a different shape (it
 * hands the decision to Director); the routes have no such third state.
 */
import { readLiveTier } from '@/lib/quota/build-quota-claim'
import type { Tier } from '@/lib/quota/quota'
import { isQuotaLiveTierEnabled } from '@/lib/quota/live-tier-flag'

export async function resolveQuotaTier(userId: string, sessionTier: Tier): Promise<Tier> {
  if (!isQuotaLiveTierEnabled()) return sessionTier
  try {
    return ((await readLiveTier(userId)) || 'free') as Tier
  } catch (error) {
    console.error('[quota] live tier read failed, using the session tier:', error)
    return sessionTier
  }
}
