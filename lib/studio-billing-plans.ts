// BILLING-L5 (FRONTEND-2, B67; L-BILLING F1/F2/F5 copy, the Studio half). Flag NEXT_PUBLIC_STUDIO_BILLING_PLANS (exact "true", default off, read at build time).
// Import-free of I/O: the flag, the plan list with each plan's monthly credits, the three top-up packs as credits, the spend-order line and the "about N decks" copy.
// The view (components/billing/studio-plan-credits.tsx) draws what this file returns; the preview route (app/(app)/billing/plans/page.tsx) is a 404 with the flag off.
//
// The numbers are L-BILLING's model (streams/pass5/L-BILLING-SPEC.md §0, pricing v2.4), built to PK's recommended decisions (spec §6):
//   - 1 credit = $0.01 of billed value. People see credits only: never tokens, provider cost or margin (P2: x2.0 is the router's business, not a screen's);
//   - Free 150 credits a month; Starter 2,000; Pro 5,000; Max 10,000 (router plan id "premium"). Monthly only in v1 (P3);
//   - image caps Starter 40, Pro 120, Max 300 a month (ASSUMPTION in the spec until images are priced; Free has no cap in §0, so none is shown);
//   - top-ups $10 / $25 / $50 = 1,000 / 2,500 / 5,000 credits (the $100 pack is dropped); top-ups never expire, plan credits reset each month;
//   - spend order: plan credits first, then top-up credits;
//   - Free is limited by credits, and "about N decks" is copy only (P4): the low end of pricing v2.4's estimates (Free 3, Starter 20, Pro 25, Max 30).
// The plan names and list prices come from the ONE plan list (PRICING_TIERS, read through lib/studio-billing.ts's studioPlanForTier) and the packs from TOPUP_PACKS: no price is written here.
// A price is only ever drawn on a plan's Upgrade button or a pack button, never next to a usage number.
import { PRICING_TIERS, TOPUP_PACKS } from '@/lib/marketing/homepage-v2-pricing'
import { studioPlanForTier } from '@/lib/studio-billing'

export const STUDIO_BILLING_PLANS_FLAG = 'NEXT_PUBLIC_STUDIO_BILLING_PLANS'

/** On only for the exact string "true"; every other value (unset, "false", "TRUE", " true", "1") is off. */
export function studioBillingPlansOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** The flag, resolved once at build time (Next inlines NEXT_PUBLIC_ values). */
export const STUDIO_BILLING_PLANS_ENABLED = studioBillingPlansOn(process.env.NEXT_PUBLIC_STUDIO_BILLING_PLANS)

/** The router's plan ids (Max is "premium"). */
export type StudioBillingPlanId = 'free' | 'starter' | 'pro' | 'premium'

export interface StudioBillingPlanCard {
  id: StudioBillingPlanId
  name: string
  /** Credits granted each month. */
  monthlyCredits: number
  /** Generated images a month; null when the plan has no stated cap (Free). */
  imagesPerMonth: number | null
  /** Copy only (P4): the low end of the estimate. */
  aboutDecks: number
  /** "$20/month" for the Upgrade button; null for Free (no button). */
  buttonPrice: string | null
  /** The Stripe price id the existing checkout is sent (the same request the Billing page's Upgrade button makes). */
  checkoutPriceId: string | undefined
}

export interface StudioBillingPack {
  /** TOPUP_PACKS id, sent to the existing top-up checkout as it is. */
  id: string
  credits: number
  /** "$10", from TOPUP_PACKS. */
  price: string
}

/** The model's numbers by plan id: the spec's, nothing derived. */
export const STUDIO_PLAN_CREDITS: Readonly<Record<StudioBillingPlanId, { monthlyCredits: number; imagesPerMonth: number | null; aboutDecks: number }>> = {
  free: { monthlyCredits: 150, imagesPerMonth: null, aboutDecks: 3 },
  starter: { monthlyCredits: 2000, imagesPerMonth: 40, aboutDecks: 20 },
  pro: { monthlyCredits: 5000, imagesPerMonth: 120, aboutDecks: 25 },
  premium: { monthlyCredits: 10000, imagesPerMonth: 300, aboutDecks: 30 },
}

/** The packs that are sold (the $100 pack is dropped): TOPUP_PACKS ids. */
export const STUDIO_PACK_IDS: readonly string[] = ['pack_10', 'pack_25', 'pack_50']

/** 1 credit = $0.01, so a pack of N cents buys N credits. */
export const CREDITS_PER_CENT = 1

/**
 * The monthly price id each plan's Upgrade button sends to the existing checkout (app/api/stripe/create-checkout-session). Pro's is the one the Billing page already sends.
 * Starter's and Max's are refused by that checkout until FRONTEND-1's F1 accepts them (see the PR's DRAFT line for the checkout route); the button changes nothing about checkout.
 * Each read is a literal process.env.NEXT_PUBLIC_ name so Next inlines it.
 */
export function studioPlanCheckoutPriceId(id: StudioBillingPlanId): string | undefined {
  if (id === 'starter') return process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID
  if (id === 'pro') return process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID
  if (id === 'premium') return process.env.NEXT_PUBLIC_STRIPE_MAX_MONTHLY_PRICE_ID
  return undefined
}

/** Free first, then the paid plans in the shared list's order (Starter, Pro, Max), each with its monthly credits. */
export function studioBillingPlanCards(): StudioBillingPlanCard[] {
  const free: StudioBillingPlanCard = { id: 'free', name: 'Free', ...STUDIO_PLAN_CREDITS.free, buttonPrice: null, checkoutPriceId: undefined }
  const paid = (['starter', 'pro', 'premium'] as const).map((id): StudioBillingPlanCard => {
    const plan = studioPlanForTier(PRICING_TIERS, id)
    if (!plan) throw new Error(`no ${id} plan in PRICING_TIERS`)
    return { id, name: plan.name, ...STUDIO_PLAN_CREDITS[id], buttonPrice: `${plan.price}/month`, checkoutPriceId: studioPlanCheckoutPriceId(id) }
  })
  return [free, ...paid]
}

/** The three packs, as credits, from TOPUP_PACKS. */
export function studioBillingPacks(): StudioBillingPack[] {
  return STUDIO_PACK_IDS.map(id => {
    const pack = TOPUP_PACKS.find(item => item.id === id)
    if (!pack) throw new Error(`no ${id} pack in TOPUP_PACKS`)
    return { id: pack.id, credits: pack.amountCents * CREDITS_PER_CENT, price: pack.label }
  })
}

/** 10000 -> "10,000". Whole numbers only. */
export function groupCredits(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** "1,000 credits for $10": the pack button's label (the only place a pack price is drawn). */
export function studioPackLabel(pack: StudioBillingPack): string {
  return `${groupCredits(pack.credits)} credits for ${pack.price}`
}

/** The plan's account tier as a plan id ("max" is premium); null for anything else. */
export function studioBillingPlanIdForTier(tier: unknown): StudioBillingPlanId | null {
  const id = tier === 'max' ? 'premium' : tier
  return id === 'free' || id === 'starter' || id === 'pro' || id === 'premium' ? id : null
}

export const STUDIO_BILLING_PLANS_WORDS = {
  title: 'Plan & credits',
  intro: 'Every plan comes with monthly credits. Generating decks, slides and images uses credits.',
  monthlyCredits: (credits: number) => `${groupCredits(credits)} credits a month`,
  images: (images: number) => `Up to ${groupCredits(images)} images a month`,
  aboutDecks: (decks: number) => `About ${decks} decks a month`,
  aboutNote: 'Deck counts are estimates. The credits a deck uses depend on its length, research and images.',
  upgrade: 'Upgrade',
  current: 'Your plan',
  spendOrder: 'Your plan credits are used first, then your top-up credits. Plan credits reset each month; top-up credits never expire.',
  packsTitle: 'Top up',
  packsIntro: 'Add credits any time, on any plan.',
  usageTitle: 'Your credits',
} as const
