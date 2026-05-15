import Link from "next/link"
import { Check } from "lucide-react"
import {
  PRICING_COPY,
  PRICING_TIERS,
  type PricingTier,
} from "@/lib/marketing/homepage-v2-pricing"
import { SectionHeader } from "../shared/SectionHeader"

export function PricingV2Section() {
  return (
    <section
      id="pricing"
      className="relative isolate overflow-hidden bg-[hsl(240,10%,98%)] py-20 sm:py-24 lg:py-28"
    >
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={PRICING_COPY.eyebrow}
          title={PRICING_COPY.title}
          description={PRICING_COPY.description}
        />

        <div className="mx-auto mt-14 grid w-full max-w-5xl grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <PricingTierCard key={tier.id} tier={tier} />
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          Need the full breakdown? See the{" "}
          <Link
            href="/pricing"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            full pricing page
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

function PricingTierCard({ tier }: { tier: PricingTier }) {
  const isHighlighted = tier.highlighted ?? false
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 sm:p-7 ${
        isHighlighted
          ? "border-primary/40 bg-white shadow-[0_30px_70px_-20px_hsl(250_90%_60%/0.35)] ring-1 ring-primary/10"
          : "border-foreground/10 bg-white shadow-sm"
      }`}
    >
      {isHighlighted ? (
        <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Most popular
        </span>
      ) : null}

      <header>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/55">
          {tier.name}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold tracking-tight text-foreground">
            {tier.price}
          </span>
          {tier.priceSuffix ? (
            <span className="text-xs text-muted-foreground">
              {tier.priceSuffix}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tier.blurb}</p>
      </header>

      <ul className="my-6 flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm leading-snug text-foreground/85"
          >
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isHighlighted ? "text-primary" : "text-foreground/55"
              }`}
              aria-hidden
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={tier.ctaHref}
        className={`group inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-all ${
          tier.ctaKind === "primary"
            ? "bg-primary text-white hover:scale-[1.02] hover:bg-primary/90"
            : "border border-foreground/15 bg-white text-foreground hover:border-foreground/30 hover:bg-foreground/[0.04]"
        }`}
      >
        {tier.ctaLabel}
      </Link>
    </article>
  )
}
