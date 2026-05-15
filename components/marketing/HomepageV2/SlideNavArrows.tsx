"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

/**
 * Soft up/down arrow buttons fixed to the bottom-right corner. Click moves
 * the page exactly one slide via the same scrollIntoView call that the
 * keyboard navigation in HomepageSnap uses, so click/key/scroll all land at
 * the same snap points.
 *
 * The active state (which buttons are enabled) is recomputed on every
 * scroll/resize so the up button greys out on the first slide and the down
 * button greys out on the last.
 */
const HEADER_OFFSET_PX = 48
const SCROLL_TOLERANCE_PX = 32

function getSlides(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('main section[data-snap="slide"]'),
  )
}

function snapToAdjacent(direction: 1 | -1) {
  const slides = getSlides()
  if (slides.length === 0) return
  const currentTop = window.scrollY + HEADER_OFFSET_PX

  if (direction === 1) {
    const next = slides.find(
      (s) => s.offsetTop > currentTop + SCROLL_TOLERANCE_PX,
    )
    next?.scrollIntoView({ behavior: "smooth", block: "start" })
  } else {
    let prev: HTMLElement | null = null
    for (const s of slides) {
      if (s.offsetTop < currentTop - SCROLL_TOLERANCE_PX) prev = s
      else break
    }
    prev?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

function computeBounds(): { canUp: boolean; canDown: boolean } {
  const slides = getSlides()
  if (slides.length === 0) return { canUp: false, canDown: false }
  const currentTop = window.scrollY + HEADER_OFFSET_PX
  const canUp = slides.some(
    (s) => s.offsetTop < currentTop - SCROLL_TOLERANCE_PX,
  )
  const canDown = slides.some(
    (s) => s.offsetTop > currentTop + SCROLL_TOLERANCE_PX,
  )
  return { canUp, canDown }
}

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
