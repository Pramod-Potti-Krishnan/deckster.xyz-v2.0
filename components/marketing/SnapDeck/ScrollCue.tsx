"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { trackCta } from "@/lib/analytics"
import { snapToAdjacent } from "./use-snap-navigation"

/**
 * Narrative connector at a slide's bottom edge — a caps promise of what the
 * next slide delivers ("SEE THE TEAM IN ACTION") rather than a mechanical
 * scroll instruction. Clicking advances exactly one slide; the whole thing
 * fades once the visitor starts scrolling so it never overlaps slide 2.
 * Slide position lives in the progress rail, not here.
 */
export function ScrollCue({ label }: { label: string }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 80)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => {
        trackCta("hero_scroll_cue")
        snapToAdjacent(1)
      }}
      aria-label={`${label} — go to next slide`}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit flex-col items-center gap-1 rounded-full px-4 py-1.5 text-white/60 transition-all duration-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:bottom-5 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">
        {label}
      </span>
      <ChevronDown
        className="h-4 w-4 animate-bounce motion-reduce:animate-none"
        aria-hidden
      />
    </button>
  )
}
