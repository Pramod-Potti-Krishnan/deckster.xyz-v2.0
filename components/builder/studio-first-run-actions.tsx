"use client"

import Link from "next/link"
import { FileUp, LayoutTemplate, RectangleHorizontal } from "lucide-react"
import { StudioIntroductionButton } from "@/components/builder/studio-introduction"
import "./studio-first-run.css"

/**
 * PASS2 #2 (flag NEXT_PUBLIC_STUDIO_FIRST_RUN_V2): while the first-run welcome has the stage out of sight, the stage's own quiet
 * actions sit here instead, under the starters: Replay intro and Explore templates (both on the welcome stage today) and
 * Start on a blank canvas (on the blank deck's placeholder today; same handler, only offered when a blank deck exists).
 * NEXT_PUBLIC_STUDIO_DECK_IMPORT (default off): one more link, "Import a PowerPoint", to the Decks page, which opens its import dialog (ruling I5a). Off, it is not drawn.
 */
export function StudioFirstRunActions({ onStartBlank }: { onStartBlank?: () => void }) {
  return (
    <div data-studio-first-run-actions="true" role="group" aria-label="More ways to start">
      <StudioIntroductionButton className="studio-first-run-link" />
      <Link href="/studio/templates" className="studio-first-run-link"><LayoutTemplate size={13} aria-hidden="true" />Explore templates</Link>
      {process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === "true" && <Link href="/dashboard?import=pptx" className="studio-first-run-link" data-studio-deck-import-builder="true"><FileUp size={13} aria-hidden="true" />Import a PowerPoint</Link>}
      {onStartBlank && (
        <button type="button" className="studio-first-run-link" data-studio-first-run-blank="true" onClick={onStartBlank}>
          <RectangleHorizontal size={13} aria-hidden="true" />Start on a blank canvas
        </button>
      )}
    </div>
  )
}
