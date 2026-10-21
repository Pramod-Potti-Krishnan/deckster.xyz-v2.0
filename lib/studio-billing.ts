// PASS2 ACC-12/13/14 (flag NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off). Import-free: the plan words and the usage meters, no I/O.
//
// ONE plan list. lib/marketing/homepage-v2-pricing.ts (PRICING_TIERS: Starter $20, Pro $50, Max $100) already single-sources the quota caps and the
// Landing buttons; with the flag on, Billing and Landing read their plan words from that same list too, so the three agree:
//   ACC-13 the price shown is the plan's price from that list, never a fixed literal;
//   ACC-14 the included list is the plan's own features (no "4 AI agents", no "Enterprise"), and the next plan up is the next entry of the list.
// The plan is matched from the account's tier (free / starter / pro / premium). A tier that matches no plan falls back to the billing cycle in words.
//
// ACC-12 the usage card on Billing shows the SAME daily / weekly numbers the account menu shows (/api/usage/quota), in place of the "Planned" row.

/** The part of a PRICING_TIERS entry this file reads. */
export interface StudioPlan {
  id: string
  name: string
  price: string
  priceSuffix?: string
  blurb: string
  features: readonly string[]
  usageNote: string
}

/** The plan for an account tier or a Landing tier id ("max" is the premium plan), or null (free, unknown, empty). */
export function studioPlanForTier(plans: readonly StudioPlan[], tier: unknown): StudioPlan | null {
  const id = tier === 'max' ? 'premium' : tier
  return plans.find(plan => plan.id === id) ?? null
}

/** "$50 per user / mo": the words Landing prints under the plan's name. */
export function studioPlanPrice(plan: StudioPlan): string {
  return plan.priceSuffix ? `${plan.price} ${plan.priceSuffix}` : `${plan.price}/month`
}

/**
 * The line under the plan's name on Billing. A matched plan shows its price from the list ("Billed yearly" is added for a yearly subscription: the list holds
 * the monthly price and /api/subscription returns no amount). No matching plan: the billing cycle in words; no subscription either: "No charge", as before.
 */
export function studioBillingPriceLine(plans: readonly StudioPlan[], tier: unknown, billingCycle: unknown): string {
  const plan = studioPlanForTier(plans, tier)
  if (plan) return billingCycle === 'yearly' ? `${studioPlanPrice(plan)} · Billed yearly` : studioPlanPrice(plan)
  if (billingCycle === 'yearly') return 'Billed yearly'
  if (billingCycle === 'monthly') return 'Billed monthly'
  return 'No charge'
}

export interface StudioPlanLine {
  text: string
  /** "Everything in Starter, plus:" introduces the lines below it; it is not a feature of its own. */
  lead: boolean
}

/** The plan's own lines in list order. */
export function studioPlanLines(plan: StudioPlan): StudioPlanLine[] {
  return plan.features.map(text => ({ text, lead: /:\s*$/.test(text) }))
}

/** The plan after this one in the list (the upgrade), or null for the last one. */
export function studioNextPlan(plans: readonly StudioPlan[], plan: StudioPlan | null): StudioPlan | null {
  if (!plan) return null
  const index = plans.findIndex(item => item.id === plan.id)
  return index >= 0 && index < plans.length - 1 ? plans[index + 1] : null
}

/**
 * Landing's tiers (the home pricing section and the pricing page) with the plan words taken from the shared list. Flag off: the same array back, untouched.
 * Only the plan's words change (name, price, suffix, blurb, features, note); a tier's own tag, button label and any other field stay as Landing has them.
 */
export function studioLandingTiers<T extends { id: string }>(tiers: readonly T[], plans: readonly StudioPlan[], enabled: boolean): readonly T[] {
  if (enabled !== true) return tiers
  return tiers.map(tier => {
    const plan = studioPlanForTier(plans, tier.id)
    if (!plan) return tier
    const words = { name: plan.name, price: plan.price, blurb: plan.blurb, features: plan.features, note: plan.usageNote }
    return (plan.priceSuffix ? { ...tier, ...words, suffix: plan.priceSuffix } : { ...tier, ...words }) as T
  })
}

// ---------------------------------------------------------------- ACC-12: the usage meters

export type StudioBillingMeterId = 'daily' | 'weekly'

export interface StudioBillingMeter {
  id: StudioBillingMeterId
  label: string
  /** Whole percent of the allowance that is left, 0 to 100. */
  percent: number
  /** "Resets in 5h" or "Resets Oct 28"; empty when the read carries no usable reset time. */
  reset: string
}

/** The part of the quota read the card uses (the shape /api/usage/quota returns and the account menu reads). */
export interface StudioBillingQuota {
  remainingPct?: { daily?: unknown; weekly?: unknown } | null
  resetAt?: { daily?: unknown; weekly?: unknown } | null
}

export const STUDIO_BILLING_USAGE_WORDS = {
  title: 'Creative capacity',
  left: 'left',
  loading: '…',
  unavailable: 'Not available right now',
} as const

const METERS: readonly { id: StudioBillingMeterId; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
]

/** Whole percent left for a 0..1 share (clamped); null for anything that is not a finite number, so no meter shows a made-up value. */
export function studioBillingPercent(share: unknown): number | null {
  return typeof share === 'number' && Number.isFinite(share) ? Math.round(Math.max(0, Math.min(1, share)) * 100) : null
}

const HOUR_MS = 3_600_000
const shortDate = (date: Date): string => date.toLocaleDateString([], { month: 'short', day: 'numeric' })

/** When the allowance resets: hours while under a day away, the date after that; empty for a missing or unreadable time. */
export function studioBillingReset(resetAt: unknown, now: Date, formatDate: (date: Date) => string = shortDate): string {
  if (typeof resetAt !== 'string') return ''
  const at = new Date(resetAt)
  const ms = at.getTime() - now.getTime()
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'Resets now'
  const hours = Math.floor(ms / HOUR_MS)
  if (hours < 1) return 'Resets in under 1h'
  return hours < 24 ? `Resets in ${hours}h` : `Resets ${formatDate(at)}`
}

/** The card's meters, daily then weekly; a meter whose share is unreadable is left out (none at all when the read has neither). */
export function studioBillingMeters(quota: StudioBillingQuota | null | undefined, now: Date = new Date(), formatDate?: (date: Date) => string): StudioBillingMeter[] {
  if (!quota) return []
  const meters: StudioBillingMeter[] = []
  for (const { id, label } of METERS) {
    const percent = studioBillingPercent(quota.remainingPct?.[id])
    if (percent === null) continue
    meters.push({ id, label, percent, reset: studioBillingReset(quota.resetAt?.[id], now, formatDate) })
  }
  return meters
}
