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
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,98%)] dark:bg-[hsl(240,10%,8%)] pb-6 pt-6 sm:pb-8 sm:pt-8"
    >
      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={PRICING_COPY.eyebrow}
          title={PRICING_COPY.title}
          description={PRICING_COPY.description}
        />

        <div className="mx-auto mt-6 grid w-full max-w-5xl grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <PricingTierCard key={tier.id} tier={tier} />
          ))}
        </div>

        <TopUpStrip />

        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-muted-foreground">
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

export function PricingTierCard({ tier }: { tier: PricingTier }) {
  const isHighlighted = tier.highlighted ?? false
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 ${
        isHighlighted
          ? "border-primary/40 bg-white dark:bg-white/[0.06] shadow-[0_30px_70px_-20px_hsl(250_90%_60%/0.35)] ring-1 ring-primary/10"
          : "border-foreground/10 bg-white dark:bg-white/[0.04] shadow-sm"
      }`}
    >
      {isHighlighted ? (
        <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Most popular
        </span>
      ) : null}

      <header>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/55 dark:text-white/55">
          {tier.name}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold tracking-tight text-foreground dark:text-white sm:text-4xl">
            {tier.price}
          </span>
          {tier.priceSuffix ? (
            <span className="text-xs text-muted-foreground">
              {tier.priceSuffix}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{tier.blurb}</p>
      </header>

      <ul className="mt-4 mb-2 flex-1 space-y-1.5">
        {tier.features.map((f) => {
          const isPlusPrefix = f.startsWith("+ ") || f.endsWith(", plus:")
          return (
            <li
              key={f}
              className={`flex items-start gap-2 text-sm leading-snug ${
                f.endsWith(", plus:")
                  ? "font-semibold text-foreground/65 dark:text-white/65"
                  : "text-foreground/85 dark:text-white/85"
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

      <p className="mb-3 text-[11px] italic leading-snug text-muted-foreground">
        {tier.usageNote}
      </p>

      <Link
        href={tier.ctaHref}
        className={`group inline-flex h-10 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-all ${
          tier.ctaKind === "primary"
            ? "bg-primary text-white hover:scale-[1.02] hover:bg-primary/90"
            : "border border-foreground/15 dark:border-white/15 bg-white dark:bg-white/[0.06] text-foreground dark:text-white hover:border-foreground/30 dark:hover:border-white/30 hover:bg-foreground/[0.04] dark:hover:bg-white/10"
        }`}
      >
        {tier.ctaLabel}
      </Link>
    </article>
  )
}

function TopUpStrip() {
  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-col items-center gap-2 rounded-2xl border border-foreground/10 dark:border-white/10 bg-white dark:bg-white/[0.04] px-6 py-3 text-center shadow-sm sm:flex-row sm:items-start sm:gap-4 sm:text-left">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Plus className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground dark:text-white">
          {PRICING_COPY.topUpHeadline}
        </div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          {PRICING_COPY.topUpBlurb}
        </p>
      </div>
    </div>
  )
}
