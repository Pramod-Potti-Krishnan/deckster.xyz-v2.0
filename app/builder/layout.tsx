import dynamic from "next/dynamic"
import { Suspense, type ReactNode } from "react"

/**
 * NEXT_PUBLIC_STUDIO_DECK_IMPORT (exact "true", default off; build-time), with the Studio shell: a deck this browser imported from a PowerPoint file gets one small note in the Builder (the
 * design is kept, so the theme and Add Element cannot change it; contract section 3). The Builder page itself (page.tsx) is not touched. The note's module is loaded lazily, so a build with the
 * flag off (or not set) ships the Builder exactly as it was: no wrapper, no note, no request.
 */
const StudioDeckImportNote = dynamic(() => import("@/components/studio-deck-import/studio-deck-import-note").then(module => module.StudioDeckImportNote))

export default function BuilderLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true" || process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== "true") return <>{children}</>
  return <>
    {children}
    <Suspense fallback={null}><StudioDeckImportNote /></Suspense>
  </>
}
