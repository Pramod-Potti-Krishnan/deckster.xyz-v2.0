"use client"

import type { ReactNode } from "react"
import { useStudioP2DeckTitles, type StudioDeckDirectory } from "@/hooks/use-studio-p2-deck-titles"

// PASS2 SB-10: owns the one read of the person's deck list for the inspector (flag on only; the page renders this only then, so flag off adds no hook and no request).
// `enabled` turns on at the first selection; the list stays for the rest of the page's life (the page is keyed by account).
export function StudioP2DeckProvider({ enabled, children }: { enabled: boolean; children: (decks: StudioDeckDirectory) => ReactNode }) {
  const decks = useStudioP2DeckTitles(enabled)
  return <>{children(decks)}</>
}
