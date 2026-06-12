"use client"

import { useEffect, useRef, useState } from "react"
import { trackSlideView } from "@/lib/analytics"
import { HEADER_OFFSET_PX, SCROLL_TOLERANCE_PX } from "./constants"
import { getSlides } from "./use-snap-navigation"

interface SlideInfo {
  id: string
  label: string
}

function readSlides(): SlideInfo[] {
  return getSlides().map((el, i) => ({
    id: el.id || `slide-${i}`,
    label:
      el.dataset.slideLabel ||
      (el.id ? el.id.charAt(0).toUpperCase() + el.id.slice(1) : `Slide ${i + 1}`),
  }))
}

/**
 * Presentation-style progress rail — one dot per slide, fixed to the right
 * edge, vertically centred. Leans into the page-as-deck metaphor: visitors
 * see how many slides there are, where they are, and can jump to any one.
 *
 * Active index uses the same offsetTop math as SlideNavArrows and the
 * keyboard nav in use-snap-navigation, so rail, arrows, and keys can never
 * disagree about the current slide. Hidden below md — on phones the corner
 * arrows suffice and right-edge space is scarce.
 *
 * Slide changes fire a debounced `slide_view` analytics event, giving a
 * per-slide funnel without extra wiring in the sections themselves.
 */
export function SlideProgressRail() {
  const [slides, setSlides] = useState<SlideInfo[]>([])
  const [active, setActive] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTrackedRef = useRef(-1)

  useEffect(() => {
    setSlides(readSlides())

    let rafId: number | null = null
    const update = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        const els = getSlides()
        const currentTop = window.scrollY + HEADER_OFFSET_PX + SCROLL_TOLERANCE_PX
        let idx = 0
        for (let i = 0; i < els.length; i++) {
          if (els[i].offsetTop <= currentTop) idx = i
        }
        setActive(idx)
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

  // Debounce slide_view so a fast flick through the deck only records the
  // slide the visitor actually lands on.
  useEffect(() => {
    if (slides.length === 0) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (lastTrackedRef.current !== active) {
        lastTrackedRef.current = active
        trackSlideView(slides[active]?.label ?? `Slide ${active + 1}`, active)
      }
    }, 600)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [active, slides])

  if (slides.length === 0) return null

  return (
    <nav
      aria-label="Slides"
      className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 md:block"
    >
      <div className="flex flex-col items-center gap-1 rounded-full border border-white/15 bg-slate-900/55 px-2 py-3 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <span
          aria-hidden
          className="mb-1 select-none text-[10px] font-medium tabular-nums text-white/60"
        >
          {active + 1}/{slides.length}
        </span>
        {slides.map((slide, i) => {
          const isActive = i === active
          return (
            <button
              key={slide.id}
              type="button"
              aria-label={`Slide ${i + 1} of ${slides.length}: ${slide.label}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() =>
                getSlides()[i]?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="group relative flex h-5 w-5 items-center justify-center focus-visible:outline-none"
            >
              <span
                className={`block w-1.5 rounded-full transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-primary ${
                  isActive ? "h-5 bg-white" : "h-1.5 bg-white/40 group-hover:bg-white/70"
                }`}
              />
              {/* Label flag on hover/focus */}
              <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/15 bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {slide.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
