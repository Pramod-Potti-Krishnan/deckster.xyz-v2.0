/**
 * Phase 5 — homepage pricing teaser data.
 *
 * The full pricing page lives at /pricing. This file drives only the
 * 3-card teaser on the homepage. Real numbers should be confirmed with
 * billing/finance before launch — current numbers are placeholders that
 * match the legacy site.
 */

export type PricingCtaKind = "primary" | "secondary"

export interface PricingTier {
  id: "free" | "pro" | "enterprise"
  name: string
  price: string
  priceSuffix?: string
  blurb: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  ctaKind: PricingCtaKind
  highlighted?: boolean
}

export const PRICING_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceSuffix: "forever",
    blurb: "Try the agents on real decks.",
    features: [
      "5 decks per month",
      "All 9 element types",
      "PowerPoint & PDF export",
      "Single user",
    ],
    ctaLabel: "Start Building Free",
    ctaHref: "/builder",
    ctaKind: "secondary",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$24",
    priceSuffix: "per user / mo",
    blurb: "For people who present every week.",
    features: [
      "Unlimited decks",
      "Custom themes & brand kit",
      "All charts, diagrams, infographics",
      "Connect your own data sources",
      "Priority generation",
    ],
    ctaLabel: "Upgrade to Pro",
    ctaHref: "/billing?plan=pro",
    ctaKind: "primary",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    blurb: "For teams that ship together.",
    features: [
      "SSO & SCIM provisioning",
      "Workspace-wide brand controls",
      "Audit log & compliance review",
      "Dedicated success manager",
      "SLA on uptime and generation latency",
    ],
    ctaLabel: "Talk to Sales",
    ctaHref: "/contact?plan=enterprise",
    ctaKind: "secondary",
  },
]

export const PRICING_COPY = {
  eyebrow: "Pricing",
  title: "Free for the first dozen decks. Pro from there.",
  description:
    "Start free. Upgrade when the team becomes the way you build presentations.",
} as const
