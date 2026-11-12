import { IntelligenceWorkspace } from "@/components/studio-personal/intelligence-workspace"
import { IntelligenceChooser } from "@/components/studio-personal/intelligence-p2"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function IntelligencePage() {
  // Authentication and approval use the existing /studio middleware matcher.
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") notFound()
  // PASS2 INT-01 (NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE, default off): the page opens on the model chooser; the workspace folds its workflow guide into "How it works".
  return <IntelligenceWorkspace chooser={process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true" ? <IntelligenceChooser /> : undefined} />
}
