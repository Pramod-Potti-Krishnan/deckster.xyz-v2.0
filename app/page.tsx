import type { Metadata } from "next"
import { Header } from "@/components/layout"
import {
  AgentChoreographySection,
  BuilderDemoSection,
  ElementGallerySection,
  FinalCTASection,
  Hero,
  PricingV2Section,
} from "@/components/marketing/HomepageV2"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideNavArrows } from "@/components/marketing/SnapDeck/SlideNavArrows"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"

const TITLE = "Deckster — A team of AI agents builds your deck"
const DESCRIPTION =
  "Talk to the Director. Reshape any slide. Tweak any element. A team of specialist AI agents builds and refines your presentation through conversation."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://deckster.xyz",
    siteName: "Deckster",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@deckster",
  },
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-primary/20">
      <SnapDeck />
      <SlideNavArrows />
      <SlideProgressRail />
      <Header />
      <main>
        {/* Narrative order: watch the team work (demo) → meet them
            (agents) → see what they build (gallery) → price → close. */}
        <Hero />
        <BuilderDemoSection />
        <AgentChoreographySection />
        <ElementGallerySection />
        <PricingV2Section />
        <FinalCTASection />
      </main>
    </div>
  )
}
