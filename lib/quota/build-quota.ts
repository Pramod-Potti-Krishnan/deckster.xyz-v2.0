/**
 * Build-quota decision: the one predicate behind "may this user start a paid
 * Director turn?" (R-20261007-frontend-15; contract F-quota-bq-claim v1).
 *
 * PURE: no database, no server-only imports, so it is importable anywhere and
 * testable offline. The server fills it from the LIVE database (see
 * `build-quota-claim.ts`); it never takes a tier, approval or wallet from the
 * NextAuth session JWT (those fields are client-writable on `update()`,
 * R-20261007-frontend-14).
 *
 * `isBuildBlockedByQuota` is exactly the condition Studio's browser gate
 * (`preflightDirectorTurn` in app/builder/page.tsx) blocks on:
 *   (dailyAt || weeklyAt) && walletBalanceCents <= 0
 * `scripts/test-ws-bq-claim.mjs` extracts that condition from page.tsx and
 * runs it against this function on the same fixtures, so the two cannot drift.
 */
import type { QuotaStatus } from '@/lib/quota/quota'

export const BQ_CLAIM_VERSION = 1

export const WS_BQ_CLAIM_FLAG = 'DECKSTER_WS_BQ_CLAIM_ENABLED'

/**
 * Server env flag, read at runtime (never NEXT_PUBLIC), default off. Kept here,
 * free of the database client, so light routes such as /api/version can report it.
 */
export function isWsBqClaimEnabled(): boolean {
  return process.env.DECKSTER_WS_BQ_CLAIM_ENABLED === 'true'
}

export type BuildQuotaReason = 'plan_required' | 'daily_limit' | 'weekly_limit' | 'unverified'

/** The signed `bq` field carried inside the Director WS token (contract §1). */
export interface BuildQuotaClaim {
  v: typeof BQ_CLAIM_VERSION
  /** true = may start a paid turn; false = refused (see `r`); null = could not decide. */
  ok: boolean | null
  r: BuildQuotaReason | null
  /** The LIVE tier read from the database at mint; null only when that read failed. */
  tier: string | null
  /** ISO-8601 UTC time the limiting window resets; null when not applicable. */
  reset: string | null
}

export type BuildQuotaInput = Pick<
  QuotaStatus,
  'tier' | 'flags' | 'walletBalanceCents' | 'resetAt'
> & { caps: Pick<QuotaStatus['caps'], 'monthlyCents'> }

/** A plan cap is fully used AND no prepaid reserve covers the overflow. */
export function isBuildBlockedByQuota(
  q: Pick<BuildQuotaInput, 'flags' | 'walletBalanceCents'>,
): boolean {
  return (q.flags.dailyAt || q.flags.weeklyAt) && q.walletBalanceCents <= 0
}

/**
 * Map a live quota picture to the claim.
 *  - not blocked                      -> ok:true
 *  - blocked, tier has no allowance   -> ok:false, plan_required (cap 0: free)
 *  - blocked, daily window used up    -> ok:false, daily_limit  (reset = daily)
 *  - blocked, only weekly used up     -> ok:false, weekly_limit (reset = weekly)
 * Daily wins over weekly, as the browser gate's `isDaily = q.flags.dailyAt` does.
 */
export function buildQuotaClaimFromStatus(q: BuildQuotaInput): BuildQuotaClaim {
  const tier = q.tier
  if (!isBuildBlockedByQuota(q)) {
    return { v: BQ_CLAIM_VERSION, ok: true, r: null, tier, reset: null }
  }
  if (q.caps.monthlyCents <= 0) {
    return { v: BQ_CLAIM_VERSION, ok: false, r: 'plan_required', tier, reset: null }
  }
  if (q.flags.dailyAt) {
    return { v: BQ_CLAIM_VERSION, ok: false, r: 'daily_limit', tier, reset: q.resetAt.daily }
  }
  return { v: BQ_CLAIM_VERSION, ok: false, r: 'weekly_limit', tier, reset: q.resetAt.weekly }
}

/** The lookup failed (database error or timeout): Director decides whether to retry. */
export function unverifiedBuildQuotaClaim(tier: string | null): BuildQuotaClaim {
  return { v: BQ_CLAIM_VERSION, ok: null, r: 'unverified', tier, reset: null }
}
