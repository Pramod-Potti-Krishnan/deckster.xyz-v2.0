"use client"
// FRONTEND-1 (L-BILLING F5 + Usage page). Off (NEXT_PUBLIC_STUDIO_USAGE_PAGE not "true"): 404, as before this change.
// Reads only GET /api/usage/quota and GET /api/wallet/balance. No Stripe call. Credits only.
import { useEffect, useState } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { formatCredits, isStudioUsagePageOn, refusalCopy, usageView, type UsageView } from "@/lib/studio-billing-usage"

export default function UsagePage() {
  if (!isStudioUsagePageOn()) notFound()
  return <UsageBody />
}

function UsageBody() {
  const [view, setView] = useState<UsageView | null>(null)
  const [tier, setTier] = useState<string | undefined>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    Promise.all([
      fetch("/api/usage/quota").then(r => (r.ok ? r.json() : null)),
      fetch("/api/wallet/balance").then(r => (r.ok ? r.json() : null)),
    ]).then(([quota, wallet]) => {
      if (!live) return
      if (!quota) { setFailed(true); return }
      setTier(quota.tier)
      setView(usageView(quota, wallet?.balanceCents ?? quota.walletBalanceCents))
    }).catch(() => live && setFailed(true))
    return () => { live = false }
  }, [])

  if (failed) return <main className="mx-auto max-w-2xl p-6"><h1 className="text-2xl font-semibold">Usage</h1><p className="mt-4 text-sm text-muted-foreground">We couldn't load your usage just now. Please try again in a moment.</p></main>
  if (!view) return <main className="mx-auto max-w-2xl p-6"><h1 className="text-2xl font-semibold">Usage</h1><p className="mt-4 text-sm text-muted-foreground">Loading…</p></main>

  const out = view.state === "exhausted" ? refusalCopy("credits_exhausted", tier) : null
  return (
    <main className="mx-auto max-w-2xl p-6" data-testid="studio-usage-page">
      <h1 className="text-2xl font-semibold">Usage</h1>
      <p className="mt-1 text-sm text-muted-foreground">{view.planLabel} plan · this period</p>
      <section className="mt-6 rounded-lg border p-5">
        <div className="flex justify-between text-sm"><span>Plan credits used</span><span data-testid="usage-used">{formatCredits(view.usedCredits)} of {formatCredits(view.planCredits)}</span></div>
        <div className="mt-2 h-2 rounded bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.usedFraction * 100)}>
          <div className="h-2 rounded bg-primary" style={{ width: `${Math.round(view.usedFraction * 100)}%` }} />
        </div>
        <div className="mt-4 flex justify-between text-sm"><span>Plan credits left</span><span data-testid="usage-left">{formatCredits(view.leftCredits)}</span></div>
        <div className="mt-2 flex justify-between text-sm"><span>Top-up credits (never expire)</span><span data-testid="usage-topup">{formatCredits(view.topUpCredits)}</span></div>
      </section>
      {out ? (
        <section className="mt-6 rounded-lg border p-5" data-testid="quota-refusal">
          <h2 className="font-semibold">{out.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{out.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={out.primary.href} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{out.primary.label}</Link>
            {out.secondary && <Link href={out.secondary.href} className="rounded-md border px-3 py-2 text-sm font-medium">{out.secondary.label}</Link>}
          </div>
        </section>
      ) : view.state === "low" ? (
        <p className="mt-4 text-sm">You're running low on plan credits. <Link href="/billing#top-up" className="underline">Top up</Link> or <Link href="/billing" className="underline">upgrade</Link>.</p>
      ) : null}
    </main>
  )
}
