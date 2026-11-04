"use client"

import { useStudioPass3PolishGViewport } from "@/lib/studio-pass3-polish-g"

// NEXT_PUBLIC_STUDIO_PASS3_POLISH, PR G (default off): drawn by app/(app)/layout.tsx only with the flag on, so the account pages (Decks, Knowledge, Templates, Themes, Intelligence ...) stop iOS Safari's focus zoom on iPhone and
// iPad, the way the Builder page does by calling the same hook itself. It draws nothing.
export function StudioPass3PolishGMount() {
  useStudioPass3PolishGViewport()
  return null
}
