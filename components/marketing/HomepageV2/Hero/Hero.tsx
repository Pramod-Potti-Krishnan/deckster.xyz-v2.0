import { ConversationalScopes } from "./ConversationalScopes"
import { HeroCTA } from "./HeroCTA"
import { HeroHeadline } from "./HeroHeadline"
import { KnowledgeGraphBackground } from "./KnowledgeGraphBackground"

/**
 * Hero — keep this slide intentionally light. The agent team grid + activity
 * loop were pulled out because we cover every agent in detail on the very
 * next slide (AgentChoreographySection), and stacking them here was making
 * the headline clip behind the sticky header. What stays: headline + CTAs +
 * the three conversation scopes (DECK/SLIDE/ELEMENT) since that's product
 * positioning, not agent detail.
 */
export function Hero() {
  return (
    <section
      id="hero"
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center overflow-hidden bg-[hsl(240,10%,4%)] py-10 sm:py-12"
    >
      {/* Background mesh — layered radial gradients, no raster image */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_90%_45%/0.45),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(200_95%_50%/0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(320_85%_55%/0.30),transparent_55%)]" />
        <div className="absolute inset-0 animate-[hero-mesh_30s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_60%_40%,hsl(250_90%_60%/0.35),transparent_60%)] motion-reduce:animate-none" />
        <KnowledgeGraphBackground />
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

        <div className="mt-8 sm:mt-10">
          <HeroCTA />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-7 sm:gap-3">
          {["Pitch decks", "Strategy decks", "Product specs"].map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75 backdrop-blur-md"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="mt-8 sm:mt-12">
          <ConversationalScopes />
        </div>
      </div>
    </section>
  )
}
