"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { billingPlanLabel, creditDisplay, creditPercent, microcredits, parsePublicCreditBalance, STUDIO_ROUTER_USAGE_ENABLED, type RouterCreditBalance } from "@/lib/billing/router-credit-view"
import "./studio-router-usage.css"

export { STUDIO_ROUTER_USAGE_ENABLED }
export type RouterUsageState = { kind: "loading" | "signed-out" | "disabled" | "unavailable" } | { kind: "ready"; view: RouterCreditBalance }

const date = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

/** Both surfaces share one projection; unavailable never becomes an empty allowance. */
export function StudioRouterUsageView({ state, retry, page = false }: { state: RouterUsageState; retry?: () => void; page?: boolean }) {
  const Tag = page ? "main" : "section"
  if (state.kind !== "ready") {
    const words = {
      loading: "Loading your credit usage…",
      "signed-out": "Sign in to see your credit usage.",
      disabled: "Credit usage is not switched on yet.",
      unavailable: "Credit usage is temporarily unavailable. Please try again.",
    }
    return <Tag className={`sru${page ? " sru-page" : ""}`} data-router-usage={state.kind} aria-busy={state.kind === "loading"}>
      {page && <h1>Usage</h1>}
      <p role="status">{words[state.kind]}</p>
      {state.kind === "unavailable" && retry && <button type="button" onClick={retry}>Try again</button>}
    </Tag>
  }
  const view = state.view, c = view.credits, chart = view.daily
  const percent = creditPercent(c.planUsed, c.planGranted)
  const top = chart?.days.reduce((max, day) => microcredits(day.used) > max ? microcredits(day.used) : max, BigInt(0)) ?? BigInt(0)
  return <Tag className={`sru${page ? " sru-page" : ""}`} data-router-usage="ready">
    {page && <h1>Usage</h1>}
    <header className="sru-row"><h2>{billingPlanLabel(view.plan)} plan</h2><span className="sru-muted">As of {date(view.asOf)} (UTC)</span></header>
    <section className="sru-card" aria-label="Plan credit balance">
      <p className="sru-muted">Plan period: {date(view.period.start)} – {date(view.period.end)} (UTC)</p>
      <div className="sru-row"><span>Plan credits used</span><strong>{creditDisplay(c.planUsed)} of {creditDisplay(c.planGranted)}</strong></div>
      {percent !== null && <div className="sru-track" role="progressbar" aria-label="Plan credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div>}
      <p className="sru-muted">Plan credits reset {date(view.period.end)} (UTC)</p>
      <dl className="sru-balances">
        <div><dt>Plan credits left</dt><dd>{creditDisplay(c.planLeft)}</dd></div>
        <div><dt>Top-up credits left</dt><dd>{creditDisplay(c.topUpLeft)}</dd><small>Never expire</small></div>
        <div><dt>Images this plan period</dt><dd>{view.images.used.toLocaleString("en-US")} / {view.images.cap === null ? "Unlimited" : view.images.cap.toLocaleString("en-US")}</dd></div>
      </dl>
    </section>
    {chart && <section className="sru-card" aria-label="Monthly credit activity">
      <div className="sru-row"><h3>This UTC month</h3><span>{creditDisplay(chart.used)} used</span></div>
      <p className="sru-muted">Activity since {date(chart.month.start)}. Your plan balance follows the plan period above.</p>
      {microcredits(chart.used) === BigInt(0) ? <p>No credits used this UTC month yet.</p> : <ol className="sru-bars" aria-label="Credits used per UTC day">
        {chart.days.map(day => <li key={day.day} title={`${day.day}: ${creditDisplay(day.used)}`} aria-label={`${day.day}: ${creditDisplay(day.used)}`}><i style={{ height: `${top === BigInt(0) ? 0 : Number(microcredits(day.used) * BigInt(1000) / top) / 10}%` }} /></li>)}
      </ol>}
    </section>}
    <p className="sru-actions"><Link href="/billing#top-up">Top up credits</Link><Link href="/billing">View plans</Link></p>
  </Tag>
}

function RouterUsageLoader({ page }: { page: boolean }) {
  const { user, isLoading } = useAuth()
  const userId = user?.id
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ userId: string; state: RouterUsageState } | null>(null)
  useEffect(() => {
    if (isLoading || !userId) return
    const controller = new AbortController()
    let active = true
    setResult({ userId, state: { kind: "loading" } })
    fetch("/api/account/usage", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => ({ status: response.status, body: response.ok ? await response.json() : null }))
      .then(({ status, body }) => {
        if (!active) return
        const view = parsePublicCreditBalance(body?.billing)
        const state: RouterUsageState = status === 401 ? { kind: "signed-out" } : view ? { kind: "ready", view } : body && !("billing" in body) ? { kind: "disabled" } : { kind: "unavailable" }
        setResult({ userId, state })
      })
      .catch(() => { if (active) setResult({ userId, state: { kind: "unavailable" } }) })
    return () => { active = false; controller.abort() }
  }, [userId, isLoading, attempt])
  // Account changes hide the old result synchronously, before effect cleanup or the next read.
  const state: RouterUsageState = isLoading ? { kind: "loading" } : !userId ? { kind: "signed-out" } : result?.userId === userId ? result.state : { kind: "loading" }
  return <StudioRouterUsageView state={state} page={page} retry={() => setAttempt(n => n + 1)} />
}

export function StudioRouterUsage({ page = false }: { page?: boolean }) {
  return STUDIO_ROUTER_USAGE_ENABLED ? <RouterUsageLoader page={page} /> : null
}
