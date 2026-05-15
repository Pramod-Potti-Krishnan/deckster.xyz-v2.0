"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  CATEGORY_COUNT_DISPLAY,
  CATEGORY_LABEL,
  GALLERY_CARDS,
  type GalleryCard,
  type GalleryCategory,
} from "@/lib/marketing/homepage-v2-element-gallery"
import { GalleryGlyph } from "./GalleryGlyph"

type Filter = "all" | GalleryCategory

const FILTERS: ReadonlyArray<{ id: Filter; label: string; count?: string }> = [
  { id: "all", label: "All" },
  { id: "element", label: CATEGORY_LABEL.element, count: CATEGORY_COUNT_DISPLAY.element },
  { id: "chart", label: CATEGORY_LABEL.chart, count: CATEGORY_COUNT_DISPLAY.chart },
  { id: "diagram", label: CATEGORY_LABEL.diagram, count: CATEGORY_COUNT_DISPLAY.diagram },
  { id: "infographic", label: CATEGORY_LABEL.infographic, count: CATEGORY_COUNT_DISPLAY.infographic },
]

// Autoscroll speed in CSS pixels per animation frame (~60 fps).
// 0.6 px/frame ≈ 36 px / second — slow enough to read each card glyph as
// it drifts past.
const AUTOSCROLL_SPEED_PX_PER_FRAME = 0.6
// How long to keep the autoscroll paused after a user-triggered scroll
// (manual drag, arrow-button click). Tuned so a deliberate scroll isn't
// immediately undone by the autoscroll.
const RESUME_DELAY_MS = 1500

export function ElementGalleryGrid() {
  const [filter, setFilter] = useState<Filter>("all")
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Manual pause sources: hover, focus, recent user-driven scroll, filter change
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [interactionPaused, setInteractionPaused] = useState(false)
  const interactionTimerRef = useRef<number | null>(null)
  const lastAutoscrollLeftRef = useRef(0)

  const cards = useMemo(
    () =>
      filter === "all"
        ? GALLERY_CARDS
        : GALLERY_CARDS.filter((c) => c.category === filter),
    [filter],
  )

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    bumpInteractionPause()
    el.scrollBy({ left: direction * (el.clientWidth * 0.85), behavior: "smooth" })
  }

  const bumpInteractionPause = () => {
    setInteractionPaused(true)
    if (interactionTimerRef.current !== null) {
      window.clearTimeout(interactionTimerRef.current)
    }
    interactionTimerRef.current = window.setTimeout(() => {
      setInteractionPaused(false)
      interactionTimerRef.current = null
    }, RESUME_DELAY_MS)
  }

  const handleFilter = (next: Filter) => {
    setFilter(next)
    bumpInteractionPause()
    requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" })
    })
  }

  // Detect manual scrolls so the autoscroll yields when the user drags.
  // We can't just listen for any `scroll` event because we also fire scrolls
  // ourselves — instead we compare scrollLeft to the value the autoscroll
  // last wrote.
  const onScrollerScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget
    if (Math.abs(el.scrollLeft - lastAutoscrollLeftRef.current) > 2) {
      bumpInteractionPause()
    }
  }

  // Autoscroll rAF loop. Honors prefers-reduced-motion, pauses while tab
  // is hidden, and yields to any of the pause sources above.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mql.matches) return

    let rafId = 0
    const tick = () => {
      if (
        !hoverPaused &&
        !focusPaused &&
        !interactionPaused &&
        document.visibilityState === "visible"
      ) {
        const max = el.scrollWidth - el.clientWidth - 1
        if (max > 0) {
          let next = el.scrollLeft + AUTOSCROLL_SPEED_PX_PER_FRAME
          if (next >= max) next = 0
          el.scrollLeft = next
          lastAutoscrollLeftRef.current = el.scrollLeft
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [hoverPaused, focusPaused, interactionPaused])

  // Cleanup interaction timer on unmount
  useEffect(() => {
    return () => {
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Filter element types"
        className="mx-auto mb-6 flex flex-wrap items-center justify-center gap-2"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleFilter(f.id)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-foreground/15 bg-white text-foreground/75 hover:border-foreground/30 hover:bg-foreground/[0.04]"
              }`}
            >
              <span>{f.label}</span>
              {f.count ? (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-foreground/10 text-foreground/60"
                  }`}
                >
                  {f.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div
        className="relative"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        onFocusCapture={() => setFocusPaused(true)}
        onBlurCapture={() => setFocusPaused(false)}
      >
        {/* Edge fades */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[hsl(240,10%,98%)] to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[hsl(240,10%,98%)] to-transparent"
        />

        {/* Nav arrows */}
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          aria-label="Scroll left"
          className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-foreground/15 bg-white p-2 text-foreground/75 shadow-md transition-all hover:border-foreground/30 hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          aria-label="Scroll right"
          className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-foreground/15 bg-white p-2 text-foreground/75 shadow-md transition-all hover:border-foreground/30 hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>

        <div
          ref={scrollerRef}
          onScroll={onScrollerScroll}
          className="snap-x snap-proximity overflow-x-auto scroll-smooth px-10 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex w-max gap-3 sm:gap-3.5">
            {cards.map((card) => (
              <GalleryCardItem key={card.id} card={card} />
            ))}
          </ul>
        </div>

        <p className="mt-3 text-center text-[11px] text-foreground/45">
          Drag, scroll, or use the arrows — {cards.length} {cards.length === 1 ? "element" : "elements"}
        </p>
      </div>
    </div>
  )
}

function GalleryCardItem({ card }: { card: GalleryCard }) {
  return (
    <li
      className="group relative flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-foreground/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md sm:w-44"
    >
      {card.badge ? (
        <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-foreground/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-foreground/55">
          {card.badge}
        </span>
      ) : null}
      <div
        className="relative flex aspect-square items-center justify-center px-2.5 pt-2.5"
        style={{ backgroundColor: `${card.color}0e` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-4 h-12 w-12 rounded-full opacity-30 blur-xl"
          style={{ backgroundColor: card.color }}
        />
        <div className="relative h-full w-full">
          <GalleryGlyph card={card} color={card.color} />
        </div>
      </div>
      <div className="border-t border-foreground/[0.06] px-2.5 py-1.5">
        <div className="truncate text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
          {card.label}
        </div>
        {card.group ? (
          <div className="truncate text-[9px] uppercase tracking-wider text-foreground/45">
            {card.group}
          </div>
        ) : null}
      </div>
    </li>
  )
}
