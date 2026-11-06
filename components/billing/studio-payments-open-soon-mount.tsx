"use client"

import { useStudioPaymentsOpenSoon } from "@/hooks/use-studio-payments-open-soon"

// NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): drawn by app/(app)/layout.tsx only with the flag on, so the account pages (Billing, Settings, Decks ...) and their account menu get the
// "Payments open soon" gate. The Builder page calls the same hook itself. It draws nothing.
export function StudioPaymentsOpenSoonMount() {
  useStudioPaymentsOpenSoon()
  return null
}
