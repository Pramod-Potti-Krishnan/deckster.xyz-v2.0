"use client"

import { useStudioPass3Polish } from "@/hooks/use-studio-pass3-polish"

// NEXT_PUBLIC_STUDIO_PASS3_POLISH (default off): drawn by app/(app)/layout.tsx only with the flag on, so the account pages (Decks, Knowledge, Templates, Themes, Intelligence ...) get the polish set's
// attribute on <html>. The Builder page calls the same hook itself. It draws nothing.
export function StudioPass3PolishMount() {
  useStudioPass3Polish()
  return null
}
