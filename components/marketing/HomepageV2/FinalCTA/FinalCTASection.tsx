import { FinalCTAButton } from "./FinalCTAButton"

export function FinalCTASection() {
  return (
    <section
      id="final-cta"
      className="relative isolate overflow-hidden bg-[hsl(240,10%,4%)] py-24 sm:py-28 lg:py-32"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_90%_45%/0.45),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(200_95%_50%/0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(320_85%_55%/0.30),transparent_55%)]" />
        <div className="absolute inset-0 animate-[hero-mesh_30s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_60%_40%,hsl(250_90%_60%/0.35),transparent_60%)] motion-reduce:animate-none" />
      </div>

      <div className="container relative mx-auto px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
          Talk to the team.{" "}
          <span className="block bg-gradient-to-r from-[hsl(280,90%,75%)] via-[hsl(320,90%,75%)] to-[hsl(200,95%,75%)] bg-clip-text text-transparent">
            Ship the deck.
          </span>
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-white/70 sm:text-lg">
          14-day free trial of Pro features. No templates. No pixel-pushing.
          Just a sentence and a few back-and-forths.
        </p>

        <div className="mt-9 flex justify-center">
          <FinalCTAButton />
        </div>
      </div>
    </section>
  )
}
