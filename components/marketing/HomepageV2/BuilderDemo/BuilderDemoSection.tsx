import { SectionHeader } from "../shared/SectionHeader"
import { BuilderDemoLoader } from "./BuilderDemoLoader"
import { MeetTheTeamLink } from "./MeetTheTeamLink"

export function BuilderDemoSection() {
  return (
    <section
      id="builder-demo"
      data-snap="slide"
      data-slide-label="Demo"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,5%)] pb-6 pt-8 sm:pb-8 sm:pt-10"
    >
      {/* Subtle gradient fade-in from the dark hero above */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[hsl(240,10%,4%)] to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(250_80%_30%/0.2),transparent_60%)]" />
      </div>

      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="dark"
          eyebrow="Watch the team build"
          title="From a sentence to a slide — in real time."
          description="The agents talk to each other while they work. Watch one slide assemble — live, on loop."
        />

        <div className="mx-auto mt-6 max-w-6xl sm:mt-8">
          <BuilderDemoLoader />
        </div>

        <div className="mt-5 flex justify-center sm:mt-6">
          <MeetTheTeamLink />
        </div>
      </div>
    </section>
  )
}
