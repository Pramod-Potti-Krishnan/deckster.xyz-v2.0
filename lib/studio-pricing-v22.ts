// FRONTEND-1 (W5 P4-17, Studio Pricing page v2.2). Flag NEXT_PUBLIC_STUDIO_PRICING_V22: on only for the exact string "true"; default off, and then /pricing is byte for byte as before.
// Pure data, no imports beyond the plan list, no network, no Stripe, no live price. Copy and layout only: the spec is PK's "Deckster Credit Pricing" design draft (section 2b "Number to show
// users for now", 2d top-ups, 3 feature matrix). Users see credits only, never tokens, provider cost or margin. Name, price and sign-up link of the paid plans come from PRICING_TIERS.
import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"

/** Exact "true" turns it on; anything else is off. The caller passes process.env.NEXT_PUBLIC_STUDIO_PRICING_V22 (inlined at build time). */
export function studioPricingV22On(value: string | undefined): boolean {
  return value === "true"
}

export type PricingV22TierId = "free" | "starter" | "pro" | "premium"

export interface PricingV22Tier {
  id: PricingV22TierId
  name: string
  price: string
  suffix: string
  credits: string
  decks: string
  blurb: string
  features: ReadonlyArray<string>
  ctaLabel: string
  ctaHref: string
  highlighted: boolean
}

const paid = (id: "starter" | "pro" | "premium") => PRICING_TIERS.find((tier) => tier.id === id)!

const paidTier = (id: "starter" | "pro" | "premium", credits: string, decks: string, features: ReadonlyArray<string>): PricingV22Tier => {
  const tier = paid(id)
  return { id, name: tier.name, price: tier.price, suffix: "/ month", credits, decks, blurb: tier.blurb, features, ctaLabel: tier.ctaLabel, ctaHref: tier.ctaHref, highlighted: Boolean(tier.highlighted) }
}

/** Spec 2b: credits granted per month and the number to show users for now; spec 3: the gates, user-facing. */
export const PRICING_V22_TIERS: ReadonlyArray<PricingV22Tier> = [
  {
    id: "free", name: "Free", price: "$0", suffix: "/ month", credits: "150 credits a month", decks: "2 decks a month",
    blurb: "Try Deckster on everyday models.",
    features: ["Up to 3 decks a month, 8 slides each", "Up to 4 generated images a month", "Themes and export", "View-only publish"],
    ctaLabel: "Start free", ctaHref: "/auth/signup", highlighted: false,
  },
  paidTier("starter", "2,000 credits a month", "about 20 decks a month", ["Deckster picks the model for each step", "Up to 40 generated images a month", "2 templates from your own decks a month", "Companion voice, 30 minutes a month"]),
  paidTier("pro", "5,000 credits a month", "about 25 research decks a month", ["Everything in Starter, plus:", "Web research and your own files", "Analyst chart insights", "Choose premium models (not Opus-class)", "Up to 120 generated images a month"]),
  paidTier("premium", "10,000 credits a month", "about 30 full-research decks a month", ["Everything in Pro, plus:", "Knowledge graph", "Every model, Opus included", "Author mode", "Priority queue, up to 300 images a month"]),
]

/** Spec 3, user-facing rows only (no cost column). */
export const PRICING_V22_MATRIX: ReadonlyArray<{ name: string; values: readonly [string, string, string, string] }> = [
  { name: "Deck building, themes, export", values: ["3 decks a month, 8 slides", "Included", "Included", "Included"] },
  { name: "Generated images", values: ["4 a month", "40 a month", "120 a month", "300 a month"] },
  { name: "Web research", values: ["—", "—", "Included", "Included"] },
  { name: "Deep research", values: ["—", "—", "10 runs a month", "40 runs a month"] },
  { name: "Uploads (your files)", values: ["—", "—", "50 files a month", "200 files a month"] },
  { name: "Knowledge graph", values: ["—", "—", "—", "Included"] },
  { name: "Analyst (chart insights)", values: ["—", "—", "Included", "Included"] },
  { name: "Template from your deck", values: ["—", "2 a month", "10 a month", "30 a month"] },
  { name: "Companion voice", values: ["—", "30 min a month", "120 min a month", "400 min a month"] },
  { name: "Author mode", values: ["—", "—", "5 decks a month, Sonnet", "20 decks a month, Sonnet or Opus"] },
  { name: "Premium models (your choice)", values: ["—", "Deckster picks", "Yes, except Opus-class", "All, incl. Opus"] },
  { name: "Publish and audience Q&A", values: ["View-only publish", "100 questions a month", "500 a month", "2,000 a month"] },
  { name: "Add Element", values: ["Included", "Included", "Included", "Included"] },
  { name: "Priority queue", values: ["—", "—", "—", "Included"] },
]

/** Spec 2a / 2d: how credits work and the top-up packs (1 credit = 1 cent of credit; packs 1:1). */
export const PRICING_V22_COPY = {
  eyebrow: "Pricing",
  title: "Pay in credits. See what a plan buys.",
  lede: "Every plan grants credits each month. Every action you take uses credits, and a deck's total depends on its length, research and images.",
  matrixTitle: "What each plan includes",
  creditsTitle: "How credits work",
  credits: [
    "Plan credits reset each month. Top-up credits never expire.",
    "Plan credits are used first, then top-up credits.",
    "When both run out, new actions pause with a top-up prompt; a build already running finishes.",
    "If you cancel, you move to Free and your top-up credits keep working.",
    "Deck counts are estimates for a typical deck of that plan's kind.",
  ],
  topUpsTitle: "Top-ups",
  topUps: [
    { price: "$10", credits: "1,000 credits" },
    { price: "$25", credits: "2,500 credits" },
    { price: "$50", credits: "5,000 credits" },
  ],
  headings: ["Feature", "Free", "Starter", "Pro", "Max"],
} as const
