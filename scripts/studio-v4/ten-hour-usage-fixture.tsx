'use client'

// Disposable localhost component specimen. Root supplies a strict network interceptor.
// Import the service-hook types only: useQuota(tokenUsage) would debit the wallet.
import { useEffect, useState } from 'react'
import { TokenUsageStrip } from '@/components/builder/token-usage-strip'
import { TopUpModal } from '@/components/builder/topup-modal'
import { UserProfileMenu } from '@/components/user-profile-menu'
import type { TokenScopeTotal, TokenUsagePayload } from '@/hooks/use-deckster-websocket-v2'
import type { QuotaState, QuotaStatus } from '@/hooks/use-quota'
import '@/components/layout/studio-shell.css'

export type UsageFixtureState = 'partial' | 'full' | 'near' | 'hard' | 'reserve'

const STATES: { id: UsageFixtureState; label: string }[] = [
  { id: 'partial', label: 'Partial coverage' },
  { id: 'full', label: 'Full coverage' },
  { id: 'near', label: 'Near daily limit' },
  { id: 'hard', label: 'Daily limit, no reserve' },
  { id: 'reserve', label: 'Running on reserve' },
]

function resolveState(state?: string): UsageFixtureState {
  return STATES.find((entry) => entry.id === state)?.id ?? 'partial'
}

function scope(total: number): TokenScopeTotal {
  return {
    tokens_in: total - 200, tokens_out: 200, total_tokens: total,
    cached_tokens_in: 0, reasoning_tokens: 0, per_stage: [],
  }
}

export function usageFixtureProps(state: UsageFixtureState, now: number): { tokenUsage: TokenUsagePayload; quota: QuotaState } {
  const atLimit = state === 'hard' || state === 'reserve'
  const near = state === 'near'
  // Representative local props using the current Pro cap shape. Not an account record.
  const daily = atLimit ? 625 : near ? 550 : 125
  const status: QuotaStatus = {
    tier: 'pro', tierLabel: 'Pro',
    caps: { dailyCents: 625, weeklyCents: 1250, monthlyCents: 5000 },
    spent: { dailyCents: daily, weeklyCents: 700, monthlyCents: 1400 },
    remainingPct: { daily: Math.max(0, 1 - daily / 625), weekly: 1 - 700 / 1250, monthly: 1 - 1400 / 5000 },
    flags: { dailyNear: near || atLimit, dailyAt: atLimit, weeklyNear: false, weeklyAt: false },
    walletBalanceCents: state === 'reserve' ? 2500 : 0,
    resetAt: {
      daily: new Date(now + 4.5 * 60 * 60 * 1000).toISOString(),
      weekly: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    totals: { monthTokens: 14283, monthSpendCents: 1400, lifetimeTokens: 28566, lifetimeSpendCents: 2800 },
  }
  return {
    tokenUsage: { session: scope(14283), turn: scope(934), coverage: state === 'full' ? 'full' : 'partial', action_type: 'local_component_specimen' },
    quota: { status, isLoading: false, lastCostCents: null, overflow: state === 'reserve', capped: atLimit, refetch: async () => {} },
  }
}

export default function LocalUsageFixture({ state, initialOpen = false }: { state?: string; initialOpen?: boolean }) {
  const [selected, setSelected] = useState<UsageFixtureState>(() => resolveState(state))
  const [now] = useState(() => Date.now())
  const [open, setOpen] = useState(initialOpen)
  const [longCounter, setLongCounter] = useState(false)
  const [draft, setDraft] = useState('Local fixture draft. Inspect usage and the popup without sending this text.')
  useEffect(() => { setSelected(resolveState(state)) }, [state])
  const props = usageFixtureProps(selected, now)
  const sessionUsage = { ...props.tokenUsage, session: scope(longCounter ? 1234567890 : props.tokenUsage.session.total_tokens) }

  return <div data-studio-v4-shell="true" data-studio-usage-fixture="true">
    <style>{`
      [data-studio-usage-fixture] { min-height:100dvh; padding:20px; color:var(--ss-text); }
      [data-studio-usage-fixture] > main { max-width:980px; margin:auto; display:grid; gap:18px; }
      [data-studio-usage-fixture] h1 { font-size:20px; font-weight:600; line-height:28px; }
      [data-studio-usage-fixture] p { color:var(--ss-muted); font-size:12px; line-height:20px; }
      [data-studio-usage-fixture] nav { display:flex; flex-wrap:wrap; gap:8px; }
      [data-studio-usage-fixture] nav button,[data-studio-usage-fixture-open] { border:1px solid var(--ss-line); border-radius:6px; background:var(--ss-panel); padding:7px 10px; font-size:11px; }
      [data-studio-usage-fixture] nav button[aria-pressed=true] { border-color:var(--ss-teal); color:var(--ss-teal); }
      [data-studio-usage-fixture-content] { display:grid; grid-template-columns:minmax(0,400px) minmax(0,1fr); gap:18px; align-items:start; }
      [data-studio-usage-fixture-stage] { border:1px solid var(--ss-line); border-radius:10px; background:var(--ss-panel); overflow:hidden; min-width:0; }
      [data-studio-usage-fixture-draft] { display:grid; gap:8px; padding:14px; }
      [data-studio-usage-fixture] label { font-size:12px; }
      [data-studio-usage-fixture-account] { margin-top:18px; padding-top:14px; border-top:1px solid var(--ss-line); display:grid; gap:10px; }
      [data-studio-usage-fixture-account] label { display:flex; align-items:center; gap:8px; }
      [data-studio-usage-fixture-account] input { accent-color:var(--ss-teal); }
      [data-studio-usage-fixture-account-trigger] { width:fit-content; }
      [data-studio-usage-fixture] textarea { min-height:140px; width:100%; resize:vertical; border:1px solid var(--ss-line); border-radius:7px; padding:10px; font-size:12px; line-height:20px; color:var(--ss-text); background:var(--ss-surface); }
      [data-studio-usage-fixture] :is(button,textarea,input):focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
      @media(max-width:640px) { [data-studio-usage-fixture] { padding:14px; } [data-studio-usage-fixture-content] { grid-template-columns:minmax(0,1fr); } }
    `}</style>
    <main>
      <header><h1>Native usage component specimen</h1><p role="note">Synthetic usage and quota props. No quota hook, ledger debit or connected checkout. Pack-button checks require the strict local 503 interceptor.</p></header>
      <nav aria-label="Local usage fixture state">{STATES.map((entry) => <button type="button" key={entry.id} aria-pressed={selected === entry.id} onClick={() => setSelected(entry.id)} data-studio-usage-fixture-state={entry.id}>{entry.label}</button>)}</nav>
      <div data-studio-usage-fixture-content>
        <section data-studio-usage-fixture-stage aria-label="Actual native token usage strip">
          <TokenUsageStrip {...props} onTopUp={() => setOpen(true)} />
          <div data-studio-usage-fixture-draft><label htmlFor="local-usage-draft">Local fixture draft</label><textarea id="local-usage-draft" value={draft} onChange={(event) => setDraft(event.target.value)} aria-describedby="local-usage-draft-help" /><p id="local-usage-draft-help">This local text is retained while opening, closing or switching specimens. It is never sent or saved.</p></div>
        </section>
        <section aria-label="Native reserve-credit popup"><p>Selected specimen: {STATES.find((entry) => entry.id === selected)?.label}. All counts and reset times here are synthetic props.</p><button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} data-studio-usage-fixture-open>Open native credit popup</button><p>The popup uses the unchanged four native pack handlers. Open, focus and close are local. Busy/error evidence requires root&apos;s delayed, intercepted refusal; it cannot be supplied as popup props.</p>
          <div data-studio-usage-fixture-account>
            <label htmlFor="local-long-session-counter"><input id="local-long-session-counter" type="checkbox" checked={longCounter} onChange={(event) => setLongCounter(event.target.checked)} data-studio-usage-fixture-long-counter={longCounter ? 'true' : 'false'} />Long session counter in account menu</label>
            <p role="note">This account-menu slot uses supplied local session usage, not a ledger acknowledgement. The long specimen has 1,234,567,890 session tokens and a 934-token current turn. Reopening repeats the existing current-turn delta; it does not report new usage. The native account menu retains its existing quota read, which root must intercept.</p>
            <div data-studio-usage-fixture-account-trigger><UserProfileMenu studioLabels studioPalette sessionUsage={<TokenUsageStrip tokenUsage={sessionUsage} displayMode="counter" />} /></div>
          </div>
        </section>
      </div>
    </main>
    <TopUpModal open={open} onOpenChange={setOpen} reason="Local component specimen. No connected checkout is allowed." />
  </div>
}
