"use client"

import "@/components/builder/studio-duplicate-copy-title.css"
import { useStudioDuplicateCardTitles } from "@/hooks/use-studio-duplicate-copy-title"

// NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): drawn by app/(app)/layout.tsx only with the flag on, so the Decks page's copy cards keep their " (copy)" suffix visible. It draws nothing.
export function StudioDuplicateCopyTitleMount() {
  useStudioDuplicateCardTitles()
  return null
}
