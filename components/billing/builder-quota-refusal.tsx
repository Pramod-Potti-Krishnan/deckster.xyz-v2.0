"use client"
// FRONTEND-1 (L-BILLING F5). The Builder's refusal overlay: listens for QUOTA_REFUSAL_EVENT (Director QUOTA_EXCEEDED / PLAN_REQUIRED frames, or a
// wallet precheck refusal) and shows QuotaRefusal. Off (NEXT_PUBLIC_STUDIO_USAGE_PAGE not "true"): no listener, renders null.
import { useEffect, useState } from "react"
import { QuotaRefusal } from "@/components/billing/quota-refusal"
import { isStudioUsagePageOn, QUOTA_REFUSAL_EVENT } from "@/lib/studio-billing-usage"

export function BuilderQuotaRefusal({ tier }: { tier?: string }) {
  const [code, setCode] = useState<string | null>(null)
  useEffect(() => {
    if (!isStudioUsagePageOn()) return
    const on = (e: Event) => setCode(String((e as CustomEvent).detail?.code ?? ""))
    window.addEventListener(QUOTA_REFUSAL_EVENT, on)
    return () => window.removeEventListener(QUOTA_REFUSAL_EVENT, on)
  }, [])
  if (!isStudioUsagePageOn() || !code) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="builder-quota-refusal">
      <div className="w-full max-w-md"><QuotaRefusal code={code} tier={tier} onDismiss={() => setCode(null)} /></div>
    </div>
  )
}
