/**
 * Pure billing-security helpers (B4/B5/B7/B8/B9 of SECURITY-AUDIT-BILLING.md).
 * Kept dependency-free so scripts/test-studio-billing-security.mjs can load them.
 */

/** B9: Prisma unique-constraint violation, detected by error code, not message text. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"
}

/** Prisma "table does not exist" (migration not applied yet). */
export function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021"
}

/** B9: billingCycle is derived server-side from the validated Stripe price id, never trusted from the client. */
export function billingCycleForPrice(
  priceId: unknown,
  prices: { monthly?: string | null; yearly?: string | null },
): "monthly" | "yearly" | null {
  if (typeof priceId !== "string" || !priceId) return null
  if (prices.yearly && priceId === prices.yearly) return "yearly"
  if (prices.monthly && priceId === prices.monthly) return "monthly"
  return null
}

/** The server flag for B5 (a coupon never grants a tier) and B8 (refund / dispute clawback, which may take the balance negative). Exact "true"; default off = today's behaviour. */
export const COUPON_TIER_HARDENING_FLAG = "STUDIO_BILLING_COUPON_TIER_HARDENING"
export function isCouponTierHardeningOn(env: Record<string, string | undefined>): boolean {
  return env[COUPON_TIER_HARDENING_FLAG] === "true"
}

/**
 * B5: with the flag on a coupon never changes the user's tier. The coupon schema has no grant
 * expiry, so granting its tier would be an unbounded paid plan (and would overwrite a paying
 * user's tier). Flag off: today's update, tier included.
 */
export function couponUserUpdate(couponCode: string, couponTier: string, hardened: boolean, now: Date = new Date()) {
  const base = { approved: true, approvedAt: now, approvedBy: `coupon:${couponCode}` }
  return hardened ? base : { ...base, tier: couponTier }
}

/** B8: only credit a top-up once Stripe says the money is in. */
export function isTopupPaid(session: { payment_status?: string | null }): boolean {
  return session?.payment_status === "paid"
}

/**
 * B8: cents to claw back after a (possibly partial, possibly repeated) refund.
 * Target is proportional to the refunded share of the charge, capped at what
 * was credited; returns the increment beyond what was already debited.
 */
export function refundClawbackCents(params: {
  creditedCents: number
  chargeAmount: number
  amountRefunded: number
  alreadyDebitedCents: number
}): number {
  const { creditedCents, chargeAmount, amountRefunded, alreadyDebitedCents } = params
  if (!(creditedCents > 0) || !(chargeAmount > 0) || !(amountRefunded > 0)) return 0
  const share = Math.min(1, amountRefunded / chargeAmount)
  const target = Math.min(creditedCents, Math.round(creditedCents * share))
  return Math.max(0, target - Math.max(0, alreadyDebitedCents))
}

/** B8: a dispute claws back everything credited that has not already been clawed back. */
export function disputeClawbackCents(creditedCents: number, alreadyDebitedCents: number): number {
  return Math.max(0, creditedCents - Math.max(0, alreadyDebitedCents))
}

/**
 * B7: an event is stale when a newer (by Stripe `created`) event for the same
 * subscription was already processed.
 */
export function isStaleSubscriptionEvent(eventCreated: number, newestProcessedCreated: number | bigint | null | undefined): boolean {
  if (newestProcessedCreated === null || newestProcessedCreated === undefined) return false
  return eventCreated < Number(newestProcessedCreated)
}
