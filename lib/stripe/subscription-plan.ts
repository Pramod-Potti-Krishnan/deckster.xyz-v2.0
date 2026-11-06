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

// Why a subscription could not be mapped to a plan. The webhook logs it (with the price ids) when it falls back to the legacy tier.
export type StripePlanMappingFailure =
  | 'price-config-missing'
  | 'price-config-ambiguous'
  | 'items-incomplete'
  | 'no-item'
  | 'unknown-price'
  | 'multiple-base-plan-items'
  | 'product-id-missing'

export class StripePlanMappingError extends Error {
  readonly reason: StripePlanMappingFailure

  constructor(reason: StripePlanMappingFailure, message: string) {
    super(message)
    this.name = 'StripePlanMappingError'
    this.reason = reason
  }
}

export type StripePlanMappingResult =
  | { ok: true; plan: ResolvedSubscriptionPlan }
  | { ok: false; plan: null; reason: StripePlanMappingFailure; priceIds: string[] }

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
 * Throws a StripePlanMappingError, before the webhook writes anything, when the plan cannot be
 * resolved. The webhook calls tryResolveStripeSubscriptionPlan, which turns that into a result so
 * the subscription takes the legacy path instead of a 500 and an endless Stripe retry.
 */
export function resolveStripeSubscriptionPlan(
  items: SubscriptionPlanItems,
  environment: StripePlanPriceEnvironment,
): ResolvedSubscriptionPlan {
  const prices = new Map<string, { tier: PaidSubscriptionTier; billingCycle: SubscriptionBillingCycle }>()

  for (const [key, tier, billingCycle] of PLAN_PRICES) {
    const priceId = environment[key]
    if (!priceId || priceId.trim() !== priceId) {
      throw new StripePlanMappingError('price-config-missing', `Stripe plan mapping requires a nonempty ${key}`)
    }
    if (prices.has(priceId)) {
      throw new StripePlanMappingError('price-config-ambiguous', 'Stripe plan mapping requires six distinct price IDs')
    }
    prices.set(priceId, { tier, billingCycle })
  }

  if (!items || items.has_more !== false || !Array.isArray(items.data)) {
    throw new StripePlanMappingError('items-incomplete', 'Stripe plan mapping requires a complete subscription items list')
  }

  const recognizedItems = items.data.filter(item => prices.has(item.price?.id))
  if (recognizedItems.length !== 1) {
    throw new StripePlanMappingError(
      recognizedItems.length > 1 ? 'multiple-base-plan-items' : items.data.length === 0 ? 'no-item' : 'unknown-price',
      'Stripe plan mapping requires exactly one recognized base-plan item',
    )
  }

  const { price } = recognizedItems[0]
  const productId = typeof price.product === 'string' ? price.product : price.product?.id
  if (!productId || productId.trim() !== productId) {
    throw new StripePlanMappingError('product-id-missing', 'Stripe base-plan price requires a product ID')
  }

  return { ...prices.get(price.id)!, priceId: price.id, productId }
}

/**
 * The webhook's entry point. Same resolution, but a plan that cannot be resolved comes back as a
 * result (the reason and the subscription's price ids, nothing else) instead of an exception, so the
 * webhook can fall back to its legacy tier, log one warning and answer 200. Anything that is not a
 * StripePlanMappingError is a real fault and still throws.
 */
export function tryResolveStripeSubscriptionPlan(
  items: SubscriptionPlanItems,
  environment: StripePlanPriceEnvironment,
): StripePlanMappingResult {
  try {
    return { ok: true, plan: resolveStripeSubscriptionPlan(items, environment) }
  } catch (error) {
    if (!(error instanceof StripePlanMappingError)) throw error
    const data: unknown = items?.data
    const priceIds = Array.isArray(data)
      ? data.map(item => item?.price?.id).filter((id): id is string => typeof id === 'string' && id !== '')
      : []
    return { ok: false, plan: null, reason: error.reason, priceIds }
  }
}
