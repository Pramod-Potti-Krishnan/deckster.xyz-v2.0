import { STUDIO_BILLING_USAGE_WORDS, studioBillingMeters, type StudioBillingQuota } from "@/lib/studio-billing"

// PASS2 ACC-12 (NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off): the usage card's capacity row, in place of the "AI Agent Interactions: Planned" row. The same daily and
// weekly share left as the account menu (the quota read), one thin meter each, and when each resets. `quota` is undefined while the read is in flight and null when
// it failed; nothing here fetches.
export function StudioBillingCapacity({ quota }: { quota: StudioBillingQuota | null | undefined }) {
  const meters = studioBillingMeters(quota)
  return (
    <div data-studio-billing-capacity="true" role="group" aria-label={STUDIO_BILLING_USAGE_WORDS.title}>
      <div data-studio-billing-capacity-head="true">
        <span>{STUDIO_BILLING_USAGE_WORDS.title}</span>
        {meters.length === 0 && <span>{quota === undefined ? STUDIO_BILLING_USAGE_WORDS.loading : STUDIO_BILLING_USAGE_WORDS.unavailable}</span>}
      </div>
      {meters.map((meter) => (
        <div key={meter.id} data-studio-billing-meter={meter.id}>
          <div data-studio-billing-meter-head="true">
            <span>{meter.label}</span>
            <span>{meter.percent}% {STUDIO_BILLING_USAGE_WORDS.left}</span>
          </div>
          <div data-studio-billing-meter-bar="true" role="progressbar" aria-label={`${meter.label} usage left`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter.percent}>
            <i style={{ width: `${meter.percent}%` }} />
          </div>
          {meter.reset && <small>{meter.reset}</small>}
        </div>
      ))}
    </div>
  )
}
