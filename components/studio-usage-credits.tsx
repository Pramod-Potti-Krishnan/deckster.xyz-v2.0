'use client'

// STUDIO USAGE CREDITS (FRONTEND-2; B62), the view. Flag NEXT_PUBLIC_STUDIO_USAGE_CREDITS (exact "true", default off): off, <StudioUsageCredits /> draws nothing.
// It fetches /api/usage/credits ITSELF (the route reads the Model Router's usage read API for the signed-in person), so the Usage page needs no state, no effect and no fetch of its own: ONE JSX line, <StudioUsageCredits className="mt-6" />,
// plus its import. <StudioUsageCreditsView state={...} /> is the same drawing from a state (the proof renders every state through it; a page that already holds the state can use it too).
// What it shows: the plan's used-of-granted meter with the reset date (balance_period.end), plan credits left, top-up credits left and total spendable credits, and a bar chart labelled "This UTC month"
// (one CSS bar per elapsed UTC day, no chart library). States: loading, ok, a real zero-usage month (not the same as unavailable), plans unavailable, credit balance unavailable, rate limited, not switched on, an answer
// that can not be read, signed out, and a plain "could not load". Amounts are the router's decimal strings, trimmed, never rounded or turned into floats. Own stylesheet, Studio v4 tokens with fallbacks, no purple, no gradient.
import { useEffect, useState } from 'react'
import {
  STUDIO_USAGE_CREDITS_ENABLED,
  formatUsageCredits,
  formatUsageDate,
  formatUsageDay,
  usageBarHeights,
  usageBusiestDay,
  usageCreditsStateName,
  usageCreditsStateOf,
  usagePercent,
  usagePlanLabel,
  type UsageCreditsState,
  type UsageCreditsView,
} from '@/lib/studio-usage-credits'
import './studio-usage-credits.css'

const credits = (amount: string) => `${formatUsageCredits(amount)} ${amount === '1.000000' ? 'credit' : 'credits'}`

/** Plain words for each error state. The wait, when the route sent one, is in seconds. */
function errorWords(state: Extract<UsageCreditsState, { kind: 'error' }>): { title: string; body: string } {
  switch (usageCreditsStateName(state)) {
    case 'signed-out':
      return { title: 'Sign in to see your credits', body: 'Your credits show here once you are signed in.' }
    case 'unconfigured':
      return { title: 'Credits are not switched on yet', body: 'Your credit usage will show here once it is switched on for this workspace.' }
    case 'rate-limited': {
      const wait = state.retryAfterSeconds
      return { title: 'Too many requests just now', body: wait === null ? 'Please try again in a moment.' : `Please try again in ${wait} ${wait === 1 ? 'second' : 'seconds'}.` }
    }
    case 'plans-unavailable':
      return { title: 'Your plan details are not available right now', body: 'This is not zero usage. We could not read your plan just now, so nothing is shown. Please try again in a moment.' }
    case 'credit-store-unavailable':
      return { title: 'Your credit balance is not available right now', body: 'This is not zero usage. We could not read your balance just now, so nothing is shown. Please try again in a moment.' }
    case 'invalid':
      return { title: 'We could not read your usage', body: 'The answer did not look right, so nothing is shown. Please try again later.' }
    default:
      return { title: 'We could not load your credits', body: 'Please try again in a moment.' }
  }
}

function Meter({ view }: { view: UsageCreditsView }) {
  const percent = usagePercent(view.planCreditsUsed, view.planCreditsGranted)
  return (
    <div className="suc-card" data-suc-part="meter">
      <div className="suc-row">
        <span>Plan credits used</span>
        <strong data-suc-value="plan-used">{percent === null ? `${formatUsageCredits(view.planCreditsUsed)} of 0` : `${formatUsageCredits(view.planCreditsUsed)} of ${formatUsageCredits(view.planCreditsGranted)}`}</strong>
      </div>
      {percent === null ? null : (
        <div className="suc-track" role="progressbar" aria-label="Plan credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="suc-fill" style={{ width: `${percent}%` }} />
        </div>
      )}
      <p className="suc-note" data-suc-value="resets">Resets {formatUsageDate(view.balancePeriod.end)} (UTC)</p>
    </div>
  )
}

function Chart({ view }: { view: UsageCreditsView }) {
  const heights = usageBarHeights(view.daily)
  const busiest = usageBusiestDay(view.daily)
  const first = view.daily[0], last = view.daily[view.daily.length - 1]
  return (
    <div className="suc-card" data-suc-part="chart">
      <div className="suc-row">
        <h3>This UTC month</h3>
        <span data-suc-value="month-used">{credits(view.creditsUsed)} used</span>
      </div>
      {view.zeroUsage ? (
        <p className="suc-empty" data-suc-part="empty">You have not used any credits this UTC month yet.</p>
      ) : view.daily.length === 0 ? (
        <p className="suc-empty" data-suc-part="no-days">The day-by-day detail is not available for this month.</p>
      ) : (
        <>
          <ol className="suc-bars" aria-label="Credits used each day, this UTC month">
            {view.daily.map((day, at) => (
              <li key={day.date} className="suc-bar" title={`${formatUsageDay(day.date)}: ${credits(day.creditsUsed)}`} aria-label={`${formatUsageDay(day.date)}: ${credits(day.creditsUsed)}`}>
                <span className="suc-bar-fill" data-zero={heights[at] === 0 ? 'true' : undefined} style={{ height: `${heights[at] / 10}%` }} />
              </li>
            ))}
          </ol>
          <div className="suc-axis" aria-hidden="true"><span>{formatUsageDay(first.date)}</span>{view.daily.length > 1 ? <span>{formatUsageDay(last.date)}</span> : null}</div>
          {busiest ? <p className="suc-note" data-suc-value="busiest">Busiest day: {formatUsageDay(busiest.date)}, {credits(busiest.creditsUsed)}</p> : null}
        </>
      )}
    </div>
  )
}

/** The credits drawn from a state: the proof renders every state through this. */
export function StudioUsageCreditsView({ state, onRetry, className }: { state: UsageCreditsState; onRetry?: () => void; className?: string }) {
  const name = usageCreditsStateName(state)
  const root = className ? `suc ${className}` : 'suc'
  if (state.kind === 'loading') {
    return <section className={root} data-studio-usage-credits="true" data-state={name} aria-label="Credits" aria-busy="true"><p className="suc-note" role="status">Loading your credits…</p></section>
  }
  if (state.kind === 'error') {
    const words = errorWords(state)
    return (
      <section className={root} data-studio-usage-credits="true" data-state={name} aria-label="Credits">
        <div className="suc-card suc-problem" role="alert">
          <h3>{words.title}</h3>
          <p>{words.body}</p>
          {onRetry && name !== 'unconfigured' && name !== 'signed-out' ? <button type="button" className="suc-retry" onClick={onRetry}>Try again</button> : null}
        </div>
      </section>
    )
  }
  const view = state.view
  return (
    <section className={root} data-studio-usage-credits="true" data-state={name} aria-label="Credits">
      <header className="suc-head"><h2>Credits</h2><span className="suc-plan" data-suc-value="plan">{usagePlanLabel(view.plan)} plan</span></header>
      <Meter view={view} />
      <dl className="suc-balances">
        <div><dt>Plan credits left</dt><dd data-suc-value="plan-left">{formatUsageCredits(view.planCreditsLeft)}</dd></div>
        <div><dt>Top-up credits left (never expire)</dt><dd data-suc-value="topup-left">{formatUsageCredits(view.topupCreditsLeft)}</dd></div>
        <div><dt>Total you can spend</dt><dd data-suc-value="total-left">{formatUsageCredits(view.creditsLeft)}</dd></div>
      </dl>
      <Chart view={view} />
    </section>
  )
}

function StudioUsageCreditsLoader({ className }: { className?: string }) {
  const [state, setState] = useState<UsageCreditsState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setState(current => (current.kind === 'loading' ? current : { kind: 'loading' }))
    fetch('/api/usage/credits', { cache: 'no-store', credentials: 'same-origin' })
      .then(res => res.json().catch(() => null))
      .then(body => { if (live) setState(usageCreditsStateOf(body)) })
      .catch(() => { if (live) setState({ kind: 'error', code: 'usage_read_network', retryAfterSeconds: null }) })
    return () => { live = false }
  }, [attempt])
  return <StudioUsageCreditsView state={state} onRetry={() => setAttempt(count => count + 1)} className={className} />
}

/** The credits view for the Usage page: fetches /api/usage/credits itself. `className` lands on its root (the page's spacing, e.g. "mt-6"), so the page needs no wrapper element that flag off would leave behind. Flag off: nothing is drawn. */
export function StudioUsageCredits({ className }: { className?: string }) {
  return STUDIO_USAGE_CREDITS_ENABLED ? <StudioUsageCreditsLoader className={className} /> : null
}
