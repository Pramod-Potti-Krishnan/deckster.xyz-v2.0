import type { ReactNode } from "react"
import { AppHeader, BackToBuilderButton } from "@/components/layout/app-header"
import "./studio-v4-account.css"
import { StudioRail } from "@/components/layout/studio-rail"
import "@/components/layout/studio-shell.css"
// NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): the account pages' "Payments open soon" gate (Billing's upgrade and credit-pack buttons, the account menu's upgrade row).
import { STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from "@/lib/studio-payments-open-soon"
import { StudioPaymentsOpenSoonMount } from "@/components/billing/studio-payments-open-soon-mount"

/**
 * Shared shell for the authenticated account area (dashboard, settings, billing,
 * shortcuts, profile). Route-group `(app)` is non-routing, so URLs are unchanged
 * (e.g. app/(app)/dashboard → /dashboard). The builder and marketing pages live
 * outside this group and keep their own headers.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div data-studio-v4-account-frame="true" data-studio-v4-shell={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" ? "true" : undefined} data-studio-v4-account={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === "true" ? "true" : undefined} className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && <StudioRail studioEntry={<BackToBuilderButton rail />} />}
      <div data-studio-v4-shell-column="true">
        <AppHeader />
        <div data-studio-v4-shell-workspace="true">{children}</div>
      </div>
      {STUDIO_PAYMENTS_OPEN_SOON_ENABLED && <StudioPaymentsOpenSoonMount />}
    </div>
  )
}
