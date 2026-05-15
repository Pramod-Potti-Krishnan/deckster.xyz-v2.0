import { SectionHeader } from "../shared/SectionHeader"
import { BuilderDemoLoader } from "./BuilderDemoLoader"

export function BuilderDemoSection() {
  return (
    <section
      id="builder-demo"
      className="relative isolate overflow-hidden bg-[hsl(240,10%,5%)] py-20 sm:py-24 lg:py-28"
    >
      {/* Subtle gradient fade-in from the dark hero above */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[hsl(240,10%,4%)] to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(250_80%_30%/0.2),transparent_60%)]" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="dark"
          eyebrow="Watch the team build"
          title="From a sentence to a slide — in real time."
          description="The agents talk to each other while they work. Here's a single slide assembling, on loop."
        />

        <div className="mx-auto mt-12 max-w-6xl sm:mt-14">
          <BuilderDemoLoader />
        </div>
      </div>
    </section>
  )
}
