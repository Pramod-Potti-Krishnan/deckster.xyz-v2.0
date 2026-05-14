import { AgentStrip } from "./AgentStrip"
import { ElementTicker } from "./ElementTicker"
import { HeroBreadthCounters } from "./HeroBreadthCounters"
import { HeroCTA } from "./HeroCTA"
import { HeroHeadline } from "./HeroHeadline"
import { HeroSpecimens } from "./HeroSpecimens"

export function Hero() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden bg-[hsl(240,10%,4%)] pt-28 sm:pt-32"
    >
      {/* Background mesh — layered radial gradients, no raster image */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_90%_45%/0.45),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(200_95%_50%/0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(320_85%_55%/0.30),transparent_55%)]" />
        <div className="absolute inset-0 animate-[hero-mesh_30s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_60%_40%,hsl(250_90%_60%/0.35),transparent_60%)] motion-reduce:animate-none" />
        {/* Grain — inline SVG, ~1KB */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
      </div>

      <div className="container relative mx-auto px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <HeroHeadline />

        <div className="mt-9 sm:mt-10">
          <HeroCTA />
        </div>

        <div className="mt-10 sm:mt-12">
          <AgentStrip />
        </div>

        <div className="mt-12 sm:mt-14">
          <HeroBreadthCounters />
        </div>

        <div className="mt-12 sm:mt-16">
          <HeroSpecimens />
        </div>
      </div>

      <ElementTicker />
    </section>
  )
}
