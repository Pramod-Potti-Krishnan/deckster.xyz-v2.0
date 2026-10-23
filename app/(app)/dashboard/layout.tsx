import dynamic from "next/dynamic"
import type { ReactNode } from "react"

/**
 * NEXT_PUBLIC_STUDIO_DECK_IMPORT (exact "true", default off; build-time), with the Studio shell: an "Import a PowerPoint" button above the Decks page, which opens the import dialog. The Decks
 * page itself (page.tsx) is not touched. The button's module is loaded lazily, so a build with the flag off (or not set) ships the Decks page exactly as it was: no wrapper, no button, no request.
 */
const StudioDeckImportEntry = dynamic(() => import("@/components/studio-deck-import/studio-deck-import-entry").then(module => module.StudioDeckImportEntry))

export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true" || process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== "true") return <>{children}</>
  return <>
    <StudioDeckImportEntry />
    {children}
  </>
}
