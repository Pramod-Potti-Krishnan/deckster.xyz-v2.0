import type { ReactNode } from "react"
import { StudioDeckImportEntryGate } from "@/components/studio-deck-import/studio-deck-import-gate"

/**
 * NEXT_PUBLIC_STUDIO_DECK_IMPORT (exact "true", default off; build-time), with the Studio shell: an "Import a PowerPoint" button above the Decks page, which opens the import dialog. The Decks
 * page itself (page.tsx) is not touched. Off, this layout returns the page exactly as it was: no wrapper, no button, no request. The button's module and stylesheet are loaded from a small client
 * gate (components/studio-deck-import/studio-deck-import-gate.tsx), never imported here, so this layout's own assets do not carry them.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true" || process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== "true") return <>{children}</>
  return <>
    <StudioDeckImportEntryGate />
    {children}
  </>
}
