"use client"

// FRONTEND-2 (W2 P4-7/8; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH): the source chip inside a rail thumbnail, bottom-left ("Atlas Quarterly · slide 3", "From <template>", "New in your theme"). Not on the slide itself. The plan slide is
// found by the rail position (Director's slide ids are the plan position), and a slide has none when the latest frame says nothing about it, auto-apply is off, nothing matched, or the stage-open gate holds the stage closed.
import { useStudioStageOpen } from "@/lib/studio-stage-open-gate"
import { useStudioTemplateMatch } from "@/hooks/use-studio-template-match"
import "./studio-template-match.css"

export function StudioTemplateMatchChip({ slideNumber }: { slideNumber: number }) {
  const stageOpen = useStudioStageOpen()
  const { chips } = useStudioTemplateMatch()
  const chip = stageOpen ? chips.get(slideNumber) : undefined
  if (!chip) return null
  return <span data-studio-template-match="chip" data-tone={chip.tone} title={chip.text}>{chip.text}</span>
}
