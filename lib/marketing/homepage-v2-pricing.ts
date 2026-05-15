/**
 * Phase 5 — homepage pricing data.
 *
 * Sales-psychology decisions baked in:
 * - **Lead with features, never with quotas.** Don't show "8 decks/mo" or
 *   token counts on marketing surfaces. Quotas frame the value as scarcity;
 *   features frame it as capability. Capability sells, scarcity discourages.
 * - **Acknowledge usage scales with deck complexity** without committing to
 *   numbers — actuals depend on slide count, research depth, and visual
 *   richness, and we shouldn't promise anything we can't predict.
 * - **Top-ups are a relief valve, not a marketed product.** Mention they
 *   exist; don't enumerate pack sizes here. Detailed packs live on the
 *   /pricing route or in-product.
 *
 * Trial: 14-day free trial of Pro features, credit card required, auto-
 * converts to Starter on day 15. The actual trial provisioning isn't built
 * yet — see HOMEPAGE_V2_PRICING_HANDOVER.md.
 */

export type PricingCtaKind = "primary" | "secondary"

export interface PricingTier {
  id: "starter" | "pro" | "premium"
  name: string
  price: string
  priceSuffix?: string
  blurb: string
  /**
   * Feature bullets. Use the "Everything in <prev tier>, plus:" pattern so
   * upsell is visible at a glance.
   */
  features: ReadonlyArray<string>
  /** Short qualitative usage note — never a number. */
  usageNote: string
  ctaLabel: string
  ctaHref: string
  ctaKind: PricingCtaKind
  highlighted?: boolean
}

export const PRICING_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "starter",
    name: "Starter",
    price: "$20",
    priceSuffix: "per user / mo",
    blurb: "Everything to ship a polished deck on your own.",
    features: [
      "Director, Content Generator, Visualizer, Slide Composer, Theme Builder",
      "All chart, diagram, and infographic types",
      "Custom themes",
      "PowerPoint & PDF export — no watermark",
      "Top-up credits available anytime",
    ],
    usageNote: "Generous monthly credits for typical workloads.",
    ctaLabel: "Start free trial",
    ctaHref: "/builder",
    ctaKind: "secondary",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$50",
    priceSuffix: "per user / mo",
    blurb: "For people who present every week — with research.",
    features: [
      "Everything in Starter, plus:",
      "Researcher: pull live data from the open web",
      "Upload your files as source material (RAG over your corpus)",
      "Analyst: insight extraction from your numbers",
      "Higher monthly credit allowance",
    ],
    usageNote: "Suited to research-heavy and frequent presenters.",
    ctaLabel: "Start free trial",
    ctaHref: "/builder",
    ctaKind: "primary",
    highlighted: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "$100",
    priceSuffix: "per user / mo",
    blurb: "For people who present as their core work.",
    features: [
      "Everything in Pro, plus:",
      "Knowledge Graph: agents learn your domain across decks",
      "Priority generation queue",
      "Highest monthly credit allowance",
    ],
    usageNote: "Built for the heaviest, most demanding workflows.",
    ctaLabel: "Start free trial",
    ctaHref: "/builder",
    ctaKind: "secondary",
  },
]

export const PRICING_COPY = {
  eyebrow: "Pricing",
  title: "A team of agents, on tap.",
  description:
    "14-day free trial of Pro features. Credit card required, auto-converts to Starter on day 15. Top up credits anytime — no surprise bills.",
  topUpHeadline: "Need more in a busy month?",
  topUpBlurb:
    "Top-up credits available on every tier — no commitment. Actual usage depends on the length and visual richness of each deck.",
} as const
