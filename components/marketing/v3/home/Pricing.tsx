import type { CSSProperties } from "react"
import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"
import { studioLandingTiers } from "@/lib/studio-billing"
import { TrackedLink } from "../BuildCta"
import { SlideChip } from "../SlideChip"

export interface PricingHomeCopy {
  label: string
  eyebrow: string
  title: string
  lede: string
  tiers: readonly {
    id: "starter" | "pro" | "max"
    name: string
    price: string
    suffix: string
    blurb: string
    features: readonly string[]
    note: string
    cta: string
    tag?: string
  }[]
  more: string
  moreLink: string
}

// PASS2 ACC-14 (NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off): the plan words come from the shared plan list (PRICING_TIERS), the list Billing reads too. Off: the copy as written.
const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"

const tierHref = (id: "starter" | "pro" | "max") =>
  PRICING_TIERS.find((tier) => tier.id === (id === "max" ? "premium" : id))?.ctaHref ?? "/pricing"

const tierLocation = (id: "starter" | "pro" | "max") =>
  (`v3_pricing_${id}` as const)

export function Pricing({ copy }: { copy: PricingHomeCopy }) {
  const tiers = studioLandingTiers(copy.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)
  return (
    <section className="slide slide--paper" id="pricing" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <div className="tiers" data-reveal style={{ "--d": 3 } as CSSProperties}>
          {tiers.map((tier) => (
            <div className={`tier${tier.id === "pro" ? " tier--hi" : ""}`} key={tier.id}>
              {tier.tag && <span className="pill pill--agent tier__tag">{tier.tag}</span>}
              <div className="tier__name">{tier.name}</div>
              <div className="tier__price"><b>{tier.price}</b><span>{tier.suffix}</span></div>
              <p className="tier__blurb">{tier.blurb}</p>
              <ul>{tier.features.map((feature, index) => <li className={index === 0 && tier.id !== "starter" ? "plus" : undefined} key={feature}>{feature}</li>)}</ul>
              <p className="tier__note">{tier.note}</p>
              <TrackedLink className={`btn btn--${tier.id === "pro" ? "primary" : "ghost"}`} href={tierHref(tier.id)} location={tierLocation(tier.id)}>{tier.cta}</TrackedLink>
            </div>
          ))}
        </div>
        <p className="small center" style={{ marginTop: 16, "--d": 4 } as CSSProperties} data-reveal>
          {copy.more} <TrackedLink className="" href="/pricing" location="v3_pricing_full_page"><span style={{ color: "var(--accent)", fontWeight: 600 }}>{copy.moreLink}</span></TrackedLink>
        </p>
      </div>
      <SlideChip number={9} label={copy.label} />
    </section>
  )
}
