'use client'

// BILLING-L5 (FRONTEND-2, B67; L-BILLING F1/F2/F5 copy), the view. Flag NEXT_PUBLIC_STUDIO_BILLING_PLANS (exact "true", default off): off, <StudioPlanCredits /> draws nothing (no wrapper is left behind).
// What it draws: Free and the three paid plans with their monthly credits (monthly only, P3), each paid plan's image cap, "about N decks" as copy (P4) and an Upgrade for each plan above the person's own;
// the spend-order line; the three top-up packs as credits ("1,000 credits for $10"); and the person's credits from the EXISTING usage-credits view (components/studio-usage-credits.tsx, which reads /api/usage/credits
// itself, behind its own flag NEXT_PUBLIC_STUDIO_USAGE_CREDITS). No new fetch of usage is made here.
// Checkout is NOT changed, and the Billing page's rule is kept: ONLY a Free account gets the checkout button (the existing UpgradeButton, the same POST to /api/stripe/create-checkout-session the Billing
// page makes). A paid account, or one whose tier is unknown, gets a link to /pricing instead (as the Billing page's "Upgrade to ..." does), never a second subscription. A plan whose public price id is not
// set shows a disabled "Coming soon". A pack button makes the Billing page's own top-up request (POST /api/stripe/create-topup-session with the pack id).
// While NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON is on, UpgradeButton shows its own "Payments open soon" state, the /pricing upgrades and every pack button are disabled with that line.
// Credits only: a price is drawn only on an Upgrade button or a pack button; no "$" next to a usage number; no tokens, provider cost or margin anywhere.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UpgradeButton } from '@/components/billing/UpgradeButton'
import { StudioUsageCredits, StudioUsageCreditsView } from '@/components/studio-usage-credits'
import { STUDIO_USAGE_CREDITS_ENABLED, type UsageCreditsState } from '@/lib/studio-usage-credits'
import { PAYMENTS_OPEN_SOON_LINE, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from '@/lib/studio-payments-open-soon'
import {
  STUDIO_BILLING_PLANS_ENABLED,
  STUDIO_BILLING_PLANS_WORDS as WORDS,
  studioBillingPacks,
  studioBillingPlanCards,
  studioBillingPlanIdForTier,
  studioPackLabel,
  type StudioBillingPlanId,
} from '@/lib/studio-billing-plans'

const RANK: Record<StudioBillingPlanId, number> = { free: 0, starter: 1, pro: 2, premium: 3 }

interface StudioPlanCreditsProps {
  /** The person's account tier (free / starter / pro / premium / max). Unknown or absent: every paid plan offers Upgrade and none is marked as theirs. */
  currentTier?: string | null
  /** A usage state the page already holds; absent, the existing credits view fetches its own. */
  usageState?: UsageCreditsState
  className?: string
}

function PackButtons() {
  const [loading, setLoading] = useState<string | null>(null)
  const packs = studioBillingPacks()
  const soon = STUDIO_PAYMENTS_OPEN_SOON_ENABLED

  // The Billing page's own top-up request, unchanged: the route answers with Stripe's URL (or refuses while payments open soon).
  const buy = async (packId: string) => {
    setLoading(packId)
    try {
      const res = await fetch('/api/stripe/create-topup-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      console.error('Failed to create top-up session')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2" data-studio-plan-credits-part="packs">
      <h3 className="text-base font-semibold">{WORDS.packsTitle}</h3>
      <p className="text-sm text-muted-foreground">{WORDS.packsIntro}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {packs.map(pack =>
          soon ? (
            <Button key={pack.id} variant="outline" disabled aria-disabled="true" title={PAYMENTS_OPEN_SOON_LINE} data-studio-plan-pack={pack.id}>
              {studioPackLabel(pack)}
            </Button>
          ) : (
            <Button key={pack.id} variant="outline" onClick={() => buy(pack.id)} disabled={loading !== null} data-studio-plan-pack={pack.id}>
              {loading === pack.id ? 'Loading…' : studioPackLabel(pack)}
            </Button>
          ),
        )}
      </div>
      {soon ? <p className="text-sm text-muted-foreground" data-studio-plan-credits-part="packs-soon">{PAYMENTS_OPEN_SOON_LINE}</p> : null}
    </div>
  )
}

/** The plan and credits section, drawn (no flag check): the proof renders it in every state. */
export function StudioPlanCreditsView({ currentTier, usageState, className }: StudioPlanCreditsProps) {
  const current = studioBillingPlanIdForTier(currentTier)
  const cards = studioBillingPlanCards()
  const root = className ? `space-y-6 ${className}` : 'space-y-6'
  return (
    <section className={root} data-studio-plan-credits="true" aria-label={WORDS.title}>
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{WORDS.title}</h2>
        <p className="text-sm text-muted-foreground">{WORDS.intro}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-studio-plan-credits-part="plans">
        {cards.map(card => {
          const mine = current === card.id
          const offer = card.buttonPrice !== null && (current === null || RANK[card.id] > RANK[current])
          const label = `${WORDS.upgrade} · ${card.buttonPrice}`
          return (
            <li key={card.id} className="flex flex-col gap-2 rounded-lg border p-4" data-studio-plan={card.id} aria-current={mine ? 'true' : undefined}>
              <h3 className="text-base font-semibold">{card.name}</h3>
              <p className="text-sm font-medium" data-studio-plan-value="credits">{WORDS.monthlyCredits(card.monthlyCredits)}</p>
              {card.imagesPerMonth !== null ? <p className="text-sm text-muted-foreground" data-studio-plan-value="images">{WORDS.images(card.imagesPerMonth)}</p> : null}
              <p className="text-sm text-muted-foreground" data-studio-plan-value="decks">{WORDS.aboutDecks(card.aboutDecks)}</p>
              <div className="mt-auto pt-2">
                {mine ? (
                  <span className="text-sm font-medium" data-studio-plan-value="current">{WORDS.current}</span>
                ) : !offer ? null : current === 'free' ? (
                  STUDIO_PAYMENTS_OPEN_SOON_ENABLED || card.checkoutPriceId ? (
                    <UpgradeButton priceId={card.checkoutPriceId ?? ''} billingCycle="monthly" label={label} className="w-full" />
                  ) : (
                    <Button disabled aria-disabled="true" className="w-full" data-studio-plan-value="coming-soon">{WORDS.comingSoon}</Button>
                  )
                ) : STUDIO_PAYMENTS_OPEN_SOON_ENABLED ? (
                  <Button disabled aria-disabled="true" title={PAYMENTS_OPEN_SOON_LINE} className="w-full" data-studio-plan-value="pricing">{PAYMENTS_OPEN_SOON_LINE}</Button>
                ) : (
                  <a href="/pricing" className="inline-flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium" data-studio-plan-value="pricing">{label}</a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground" data-studio-plan-credits-part="about">{WORDS.aboutNote}</p>
      <p className="text-sm" data-studio-plan-credits-part="spend-order">{WORDS.spendOrder}</p>
      <PackButtons />
      {usageState || STUDIO_USAGE_CREDITS_ENABLED ? (
        <div data-studio-plan-credits-part="usage">{usageState ? <StudioUsageCreditsView state={usageState} /> : <StudioUsageCredits />}</div>
      ) : null}
    </section>
  )
}

/** The plan and credits section for the Billing page and the preview route. Flag off: nothing is drawn. */
export function StudioPlanCredits(props: StudioPlanCreditsProps) {
  return STUDIO_BILLING_PLANS_ENABLED ? <StudioPlanCreditsView {...props} /> : null
}
