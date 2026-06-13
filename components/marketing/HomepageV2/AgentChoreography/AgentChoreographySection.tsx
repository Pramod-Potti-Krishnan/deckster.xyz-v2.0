import { CHOREO_COPY } from "@/lib/marketing/homepage-v2-agent-deep"
import { SectionHeader } from "../shared/SectionHeader"
import { AgentPyramidLoader, LightningGridLazy } from "./AgentPyramidLoader"

/**
 * "Meet the team" slide. The shell + header are server-rendered (copy stays
 * crawlable); the interactive pyramid and animated background load lazily
 * through AgentPyramidLoader — see AgentPyramid.tsx for the cards, drag
 * behaviour, and connector overlay.
 */
export function AgentChoreographySection() {
  return (
    <section
      id="agents"
      data-snap="slide"
      data-slide-label="The Team"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,4%)] pb-6 pt-7 sm:pb-8 sm:pt-9"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_70%_25%/0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(200_70%_25%/0.30),transparent_60%)]" />
        <LightningGridLazy />
      </div>

      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="dark"
          eyebrow={CHOREO_COPY.eyebrow}
          title={
            // One line on wide screens; stacks to two clean lines on
            // narrower viewports so it never overflows sideways.
            <span className="xl:whitespace-nowrap">
              <span className="block xl:inline">You bring the idea.</span>{" "}
              <span className="block bg-gradient-to-r from-[hsl(280,90%,75%)] via-[hsl(320,90%,75%)] to-[hsl(200,95%,75%)] bg-clip-text text-transparent xl:inline">
                They bring the craft.
              </span>
            </span>
          }
          description={CHOREO_COPY.description}
        />

        <AgentPyramidLoader />
      </div>
    </section>
  )
}
