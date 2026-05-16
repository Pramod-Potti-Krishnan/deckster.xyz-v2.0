"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { computeBounds, snapToAdjacent } from "./use-snap-navigation"

/**
 * Soft up/down arrow buttons fixed to the bottom-right corner. Click moves
 * the page exactly one slide via the same scrollIntoView call that the
 * keyboard navigation in SnapDeck uses, so click/key/scroll all land at the
 * same snap points.
 *
 * The active state (which buttons are enabled) is recomputed on every
 * scroll/resize so the up button greys out on the first slide and the down
 * button greys out on the last.
 */
export function SlideNavArrows() {
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(true)

  useEffect(() => {
    let rafId: number | null = null
    const update = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        const { canUp, canDown } = computeBounds()
        setCanUp(canUp)
        setCanDown(canDown)
        rafId = null
      })
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const baseBtn =
    "group flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-900/55 text-white/85 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:bg-slate-900/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-slate-900/55"

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col gap-2 sm:bottom-8 sm:right-8"
      aria-label="Slide navigation"
    >
      <button
        type="button"
        onClick={() => snapToAdjacent(-1)}
        disabled={!canUp}
        aria-label="Previous slide"
        className={`pointer-events-auto ${baseBtn}`}
      >
        <ChevronUp className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-disabled:translate-y-0" />
      </button>
      <button
        type="button"
        onClick={() => snapToAdjacent(1)}
        disabled={!canDown}
        aria-label="Next slide"
        className={`pointer-events-auto ${baseBtn}`}
      >
        <ChevronDown className="h-5 w-5 transition-transform group-hover:translate-y-0.5 group-disabled:translate-y-0" />
      </button>
    </div>
  )
}
