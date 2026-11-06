import { IntelligenceWorkspace } from "@/components/studio-personal/intelligence-workspace"
import { IntelligenceChooser } from "@/components/studio-personal/intelligence-p2"
import { IntelligenceSimple } from "@/components/studio-personal/intelligence-simple" // INTELLIGENCE-SIMPLE
import { STUDIO_INTELLIGENCE_SIMPLE_ENABLED } from "@/lib/studio-intelligence-simple" // INTELLIGENCE-SIMPLE
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function IntelligencePage() {
  // Authentication and approval use the existing /studio middleware matcher.
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") notFound()
  // PASS2 INT-01 (NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE, default off): the page opens on the model chooser; the workspace folds its workflow guide into "How it works".
  if (STUDIO_INTELLIGENCE_SIMPLE_ENABLED) return <IntelligenceSimple advanced={<IntelligenceChooser />} /> // INTELLIGENCE-SIMPLE: one preset slider; the per-task chooser under Advanced, unchanged
  return <IntelligenceWorkspace chooser={process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true" ? <IntelligenceChooser /> : undefined} />
}
