import type { Metadata } from "next"
import { Footer, Header } from "@/components/layout"
import { BuilderDemoSection, Hero } from "@/components/marketing/HomepageV2"

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
      <Header />
      <main>
        <Hero />
        <BuilderDemoSection />
        {/* Phase 3+: <ElementGallery />, <AgentChoreography />,
            <LivingCanvas />, <SocialProof />, <PricingV2 />, <FinalCTA /> */}
      </main>
      <Footer />
    </div>
  )
}
