import type { ReactNode } from "react"
import { StudioP2Onboarding } from "@/components/studio-p2-onboarding"

// PASS2 ONBOARDING (NEXT_PUBLIC_STUDIO_P2_ONBOARDING, default off; it also needs the Studio shell, whose template library the wizard's "Use a template" opens): /onboarding shows the wizard in the
// Studio shell's look instead of the page below this layout. Off: this layout hands the page through untouched, and app/onboarding/page.tsx is not changed in either state.
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_ONBOARDING === "true" && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true") return <StudioP2Onboarding />
  return children
}
