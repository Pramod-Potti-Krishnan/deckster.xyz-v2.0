export type PaidSubscriptionTier = 'starter' | 'pro' | 'premium'
export type SubscriptionBillingCycle = 'monthly' | 'yearly'

export interface StripePlanPriceEnvironment {
  STRIPE_STARTER_MONTHLY_PRICE_ID?: string
  STRIPE_STARTER_YEARLY_PRICE_ID?: string
  STRIPE_PRO_MONTHLY_PRICE_ID?: string
  STRIPE_PRO_YEARLY_PRICE_ID?: string
  STRIPE_MAX_MONTHLY_PRICE_ID?: string
  STRIPE_MAX_YEARLY_PRICE_ID?: string
}

// Structural input accepts Stripe 17 subscription items without depending on the SDK at runtime.
export interface SubscriptionPlanItems {
  has_more: boolean
  data: ReadonlyArray<{
    price: {
      id: string
      product: string | { id: string }
    }
  }>
}

export interface ResolvedSubscriptionPlan {
  tier: PaidSubscriptionTier
  billingCycle: SubscriptionBillingCycle
  priceId: string
  productId: string
}

const PLAN_PRICES = [
  ['STRIPE_STARTER_MONTHLY_PRICE_ID', 'starter', 'monthly'],
  ['STRIPE_STARTER_YEARLY_PRICE_ID', 'starter', 'yearly'],
  ['STRIPE_PRO_MONTHLY_PRICE_ID', 'pro', 'monthly'],
  ['STRIPE_PRO_YEARLY_PRICE_ID', 'pro', 'yearly'],
  // Max is the existing internal premium tier used by auth, billing and quotas.
  ['STRIPE_MAX_MONTHLY_PRICE_ID', 'premium', 'monthly'],
  ['STRIPE_MAX_YEARLY_PRICE_ID', 'premium', 'yearly'],
] as const

/**
 * Resolve only trusted server-configured price IDs. A complete, unambiguous configuration
 * and exactly one recognized base-plan item are required; other prices may be add-ons.
 * Throw before the webhook writes anything so Stripe can retry after a configuration fix.
 */
export function resolveStripeSubscriptionPlan(
  items: SubscriptionPlanItems,
  environment: StripePlanPriceEnvironment,
): ResolvedSubscriptionPlan {
  const prices = new Map<string, { tier: PaidSubscriptionTier; billingCycle: SubscriptionBillingCycle }>()

  for (const [key, tier, billingCycle] of PLAN_PRICES) {
    const priceId = environment[key]
    if (!priceId || priceId.trim() !== priceId) {
      throw new Error(`Stripe plan mapping requires a nonempty ${key}`)
    }
    if (prices.has(priceId)) {
      throw new Error('Stripe plan mapping requires six distinct price IDs')
    }
    prices.set(priceId, { tier, billingCycle })
  }

  if (!items || items.has_more !== false || !Array.isArray(items.data)) {
    throw new Error('Stripe plan mapping requires a complete subscription items list')
  }

  const recognizedItems = items.data.filter(item => prices.has(item.price?.id))
  if (recognizedItems.length !== 1) {
    throw new Error('Stripe plan mapping requires exactly one recognized base-plan item')
  }

  const { price } = recognizedItems[0]
  const productId = typeof price.product === 'string' ? price.product : price.product?.id
  if (!productId || productId.trim() !== productId) {
    throw new Error('Stripe base-plan price requires a product ID')
  }

  return { ...prices.get(price.id)!, priceId: price.id, productId }
}
