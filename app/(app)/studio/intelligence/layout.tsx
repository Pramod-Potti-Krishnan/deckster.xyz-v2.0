import type { ReactNode } from "react"
import { IntelligenceModels } from "@/components/studio-personal/intelligence-models"

/**
 * NEXT_PUBLIC_STUDIO_MODEL_CATALOG (exact "true", default off; build-time), with the Studio shell (the page is a 404 without it). The Intelligence page itself (page.tsx, the workspace, the chooser)
 * is not touched: this layout adds the "Models" section below it. Off, it returns the page exactly as it was: no wrapper, no section, no request.
 */
export default function IntelligenceLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true" || process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== "true") return <>{children}</>
  return <div className="sp-mc-frame" data-studio-model-catalog-frame="true">{children}<IntelligenceModels /></div>
}
