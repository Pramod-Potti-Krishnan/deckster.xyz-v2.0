"use client"
// FRONTEND-1 (L-BILLING F5). The refusal screen shown when a user is out of credits, over a cap or needs a higher plan. Renders nothing unless
// NEXT_PUBLIC_STUDIO_QUOTA_SCREENS is "true" and the code is a billing refusal. Credits only: no cost, tokens or model ids.
import Link from "next/link"
import { isStudioQuotaScreensOn, refusalCopy, refusalKind } from "@/lib/studio-billing-usage"

export function QuotaRefusal({ code, tier, onDismiss }: { code: unknown; tier?: string; onDismiss?: () => void }) {
  if (!isStudioQuotaScreensOn()) return null
  const kind = refusalKind(code)
  if (!kind) return null
  const copy = refusalCopy(kind, tier)
  return (
    <div role="alertdialog" aria-labelledby="quota-refusal-title" data-testid="quota-refusal" className="rounded-lg border bg-background p-5 shadow-sm">
      <h2 id="quota-refusal-title" className="text-base font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={copy.primary.href} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{copy.primary.label}</Link>
        {copy.secondary && <Link href={copy.secondary.href} className="rounded-md border px-3 py-2 text-sm font-medium">{copy.secondary.label}</Link>}
        {onDismiss && <button type="button" onClick={onDismiss} className="px-3 py-2 text-sm text-muted-foreground">Not now</button>}
      </div>
    </div>
  )
}
