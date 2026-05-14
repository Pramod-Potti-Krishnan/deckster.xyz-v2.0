import { TICKER_LABELS } from "@/lib/marketing/homepage-v2-content"

export function ElementTicker() {
  // Duplicate the list so the marquee loops seamlessly when translated -50%.
  const items = [...TICKER_LABELS, ...TICKER_LABELS]

  return (
    <div className="relative w-full overflow-hidden border-y border-white/10 bg-white/[0.02]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[hsl(240,10%,4%)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[hsl(240,10%,4%)] to-transparent" />
      <div className="flex w-max animate-[hero-marquee_40s_linear_infinite] gap-10 py-4 motion-reduce:animate-none">
        {items.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="inline-flex items-center gap-10 font-mono text-xs uppercase tracking-[0.18em] text-white/40 sm:text-sm"
          >
            {label}
            <span aria-hidden className="select-none text-white/15">
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
