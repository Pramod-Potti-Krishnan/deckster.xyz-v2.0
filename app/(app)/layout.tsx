import type { ReactNode } from "react"
import { AppHeader } from "@/components/layout/app-header"

/**
 * Shared shell for the authenticated account area (dashboard, settings, billing,
 * shortcuts, profile). Route-group `(app)` is non-routing, so URLs are unchanged
 * (e.g. app/(app)/dashboard → /dashboard). The builder and marketing pages live
 * outside this group and keep their own headers.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader />
      {children}
    </div>
  )
}
