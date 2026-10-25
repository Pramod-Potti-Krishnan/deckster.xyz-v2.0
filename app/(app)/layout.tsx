import type { ReactNode } from "react"
import { AppHeader, BackToBuilderButton } from "@/components/layout/app-header"
import "./studio-v4-account.css"
import { StudioRail } from "@/components/layout/studio-rail"
import "@/components/layout/studio-shell.css"
// NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): the account pages' "Payments open soon" gate (Billing's upgrade and credit-pack buttons, the account menu's upgrade row).
import { STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from "@/lib/studio-payments-open-soon"
import { StudioPaymentsOpenSoonMount } from "@/components/billing/studio-payments-open-soon-mount"
// NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): a copied deck's card on the Decks page keeps its " (copy)" suffix visible (the deck cards' own files are held byte for byte, so the pass marks them from outside).
import { STUDIO_DUPLICATE_COPY_TITLE_ENABLED } from "@/lib/studio-duplicate-copy-title"
import { StudioDuplicateCopyTitleMount } from "@/components/builder/studio-duplicate-copy-title-mount"
// NEXT_PUBLIC_STUDIO_PASS3_POLISH (default off): the Pass 3 polish set; with the flag on <html> carries data-studio-pass3-polish="true" and the set's stylesheet (every rule scoped to it) applies to the account pages. // PASS3-POLISH
import { STUDIO_PASS3_POLISH_ENABLED } from "@/lib/studio-pass3-polish" // PASS3-POLISH
import { StudioPass3PolishMount } from "@/components/studio-pass3-polish/studio-pass3-polish-mount" // PASS3-POLISH
import "@/components/studio-pass3-polish/studio-pass3-polish-e.css" // PASS3-POLISH-E (NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off): every rule is scoped to data-studio-pass3-polish="true"; on a phone the Intelligence task selects end in an ellipsis before the chevron
import { StudioPass3PolishGMount } from "@/components/studio-pass3-polish/studio-pass3-polish-g-mount" // PASS3-POLISH-G (NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off): on iPhone and iPad the viewport meta gets maximum-scale=1, so a focused text control does not zoom the page

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
      {STUDIO_DUPLICATE_COPY_TITLE_ENABLED && <StudioDuplicateCopyTitleMount />}
      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}
      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishGMount />}{/* PASS3-POLISH-G */}
    </div>
  )
}
