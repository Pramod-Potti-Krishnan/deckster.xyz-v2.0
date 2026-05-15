import Link from "next/link"
import { Check, Plus } from "lucide-react"
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
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden bg-[hsl(240,10%,98%)] py-10 sm:py-14"
    >
      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={PRICING_COPY.eyebrow}
          title={PRICING_COPY.title}
          description={PRICING_COPY.description}
        />

        <div className="mx-auto mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <PricingTierCard key={tier.id} tier={tier} />
          ))}
        </div>

        <TopUpStrip />

        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted-foreground">
          Need the full breakdown?{" "}
          <Link
            href="/pricing"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            See the pricing page
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
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-5 sm:p-6 ${
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

      <ul className="mt-5 mb-3 flex-1 space-y-2">
        {tier.features.map((f) => {
          const isPlusPrefix = f.startsWith("+ ") || f.endsWith(", plus:")
          return (
            <li
              key={f}
              className={`flex items-start gap-2 text-sm leading-snug ${
                f.endsWith(", plus:")
                  ? "font-semibold text-foreground/65"
                  : "text-foreground/85"
              }`}
            >
              {f.endsWith(", plus:") ? (
                <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isHighlighted ? "text-primary" : "text-foreground/55"
                  }`}
                  aria-hidden
                />
              )}
              <span>{f}</span>
            </li>
          )
        })}
      </ul>

      <p className="mb-4 text-[11px] italic leading-snug text-muted-foreground">
        {tier.usageNote}
      </p>

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

function TopUpStrip() {
  return (
    <div className="mx-auto mt-5 flex max-w-3xl flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-white px-6 py-4 text-center shadow-sm sm:flex-row sm:items-start sm:gap-4 sm:text-left">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Plus className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">
          {PRICING_COPY.topUpHeadline}
        </div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          {PRICING_COPY.topUpBlurb}
        </p>
      </div>
    </div>
  )
}
