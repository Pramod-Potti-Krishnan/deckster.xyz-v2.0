import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { HERO_COPY } from "@/lib/marketing/homepage-v2-content"

export function HeroHeadline() {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <Badge
        variant="outline"
        className="mb-7 inline-flex items-center gap-2 rounded-full border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md hover:bg-white/10"
      >
        <Sparkles className="h-3 w-3 text-[hsl(200,90%,75%)]" />
        {HERO_COPY.badge}
      </Badge>

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
