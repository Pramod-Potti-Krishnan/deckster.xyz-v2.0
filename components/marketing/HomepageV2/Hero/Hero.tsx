import { AgentActivityLoop } from "./AgentActivityLoop"
import { AgentTeam } from "./AgentTeam"
import { ConversationalScopes } from "./ConversationalScopes"
import { HeroCTA } from "./HeroCTA"
import { HeroHeadline } from "./HeroHeadline"
import { KnowledgeGraphBackground } from "./KnowledgeGraphBackground"

export function Hero() {
  return (
    <section
      id="hero"
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden bg-[hsl(240,10%,4%)] py-10 sm:py-12"
    >
      {/* Background mesh — layered radial gradients, no raster image */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_90%_45%/0.45),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(200_95%_50%/0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(320_85%_55%/0.30),transparent_55%)]" />
        <div className="absolute inset-0 animate-[hero-mesh_30s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_60%_40%,hsl(250_90%_60%/0.35),transparent_60%)] motion-reduce:animate-none" />
        {/* Knowledge graph — interconnected document nodes drifting with traveling pulses (KG = Premium feature tease) */}
        <KnowledgeGraphBackground />
        {/* Grain — inline SVG, ~1KB */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
      </div>

      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <HeroHeadline />

        <div className="mt-7 sm:mt-8">
          <HeroCTA />
        </div>

        <div className="mt-8 sm:mt-10">
          <AgentTeam />
        </div>

        <div className="mt-5 sm:mt-6">
          <AgentActivityLoop />
        </div>

        <div className="mt-7 sm:mt-9">
          <ConversationalScopes />
        </div>
      </div>
    </section>
  )
}
