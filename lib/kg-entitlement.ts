/**
 * Knowledge Graph entitlement — the single source of truth (KG v2 P0, D-KG1).
 *
 * Entitled = coupon-granted `premium` user tier, OR an active/trialing paid
 * subscription (`premium`, `pro`, `enterprise`). Every KG gate in the app
 * (chat toggle, settings page, sidebar entry) must call this — do not
 * re-derive tier checks inline.
 */

const ENTITLED_SUBSCRIPTION_TIERS: string[] = ['premium', 'pro', 'enterprise']
const ACTIVE_SUBSCRIPTION_STATUSES: string[] = ['active', 'trialing']

export interface KgSubscriptionLike {
  status?: string | null
  tier?: string | null
}

export function isKgEntitled(
  userTier: string | null | undefined,
  subscription: KgSubscriptionLike | null | undefined
): boolean {
  if (userTier === 'premium') return true
  if (!subscription) return false
  return (
    ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status ?? '') &&
    ENTITLED_SUBSCRIPTION_TIERS.includes(subscription.tier ?? '')
  )
}

/** Display name for the entitled plan set — keep UI copy consistent. */
export const KG_PLAN_LABEL = 'Pro and above'
