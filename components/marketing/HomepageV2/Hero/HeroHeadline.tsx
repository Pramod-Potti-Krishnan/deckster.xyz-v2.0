import { HERO_COPY } from "@/lib/marketing/homepage-v2-content"

export function HeroHeadline() {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <span className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(200,90%,75%)] shadow-[0_0_10px_hsl(200,90%,75%/0.7)]"
        />
        {HERO_COPY.eyebrow}
      </span>

      <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
        <span className="block">{HERO_COPY.headlineLine1}</span>
        <span className="block">{HERO_COPY.headlineLine2}</span>
        <span className="block bg-gradient-to-r from-[hsl(280,90%,75%)] via-[hsl(320,90%,75%)] to-[hsl(200,95%,75%)] bg-clip-text text-transparent">
          {HERO_COPY.headlineLine3}
        </span>
      </h1>

      <p className="mt-7 max-w-2xl text-balance text-base leading-relaxed text-white/70 sm:text-lg md:text-xl">
        {HERO_COPY.subhead}
      </p>
    </div>
  )
}
