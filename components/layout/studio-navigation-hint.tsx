"use client"

import type { ReactElement } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/** Labels for the opt-in Studio navigation slice; leaves the original element intact when off. */
export function StudioNavigationHint({ enabled, label, children }: {
  enabled: boolean
  label: string
  children: ReactElement
}) {
  if (!enabled) return children

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
