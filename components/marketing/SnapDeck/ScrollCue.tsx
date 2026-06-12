"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { trackCta } from "@/lib/analytics"
import { snapToAdjacent } from "./use-snap-navigation"

/**
 * Scroll affordance for the hero slide — tells first-time visitors the page
 * is a deck they can move through ("1 of 6"), and gives them a click target
 * that advances exactly one slide. Fades out as soon as the visitor starts
 * scrolling so it never overlaps slide 2.
 */
export function ScrollCue({ slideCount = 6 }: { slideCount?: number }) {
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
      aria-label="Go to next slide"
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-white/50 transition-opacity duration-500 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:bottom-5 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="text-[11px] font-medium tracking-wide">
        1 of {slideCount} — scroll or press ↓
      </span>
      <ChevronDown
        className="h-4 w-4 animate-bounce motion-reduce:animate-none"
        aria-hidden
      />
    </button>
  )
}
