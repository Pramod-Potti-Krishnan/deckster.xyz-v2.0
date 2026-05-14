"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  CATEGORY_LABEL,
  GALLERY_CARDS,
  type GalleryCard,
  type GalleryCategory,
} from "@/lib/marketing/homepage-v2-element-gallery"
import { GalleryGlyph } from "./GalleryGlyph"

type Filter = "all" | GalleryCategory

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: "all", label: "All 75" },
  { id: "element", label: CATEGORY_LABEL.element },
  { id: "chart", label: CATEGORY_LABEL.chart },
  { id: "diagram", label: CATEGORY_LABEL.diagram },
  { id: "infographic", label: CATEGORY_LABEL.infographic },
]

const CATEGORY_COUNTS: Record<Filter, number> = (() => {
  const counts: Record<Filter, number> = {
    all: GALLERY_CARDS.length,
    element: 0,
    chart: 0,
    diagram: 0,
    infographic: 0,
  }
  for (const card of GALLERY_CARDS) counts[card.category] += 1
  return counts
})()

export function ElementGalleryGrid() {
  const [filter, setFilter] = useState<Filter>("all")

  const cards = useMemo(
    () =>
      filter === "all"
        ? GALLERY_CARDS
        : GALLERY_CARDS.filter((c) => c.category === filter),
    [filter],
  )

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Filter element types"
        className="mx-auto mb-8 flex flex-wrap items-center justify-center gap-2"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-foreground/15 bg-white text-foreground/75 hover:border-foreground/30 hover:bg-foreground/[0.04]"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-foreground/10 text-foreground/60"
                }`}
              >
                {CATEGORY_COUNTS[f.id]}
              </span>
            </button>
          )
        })}
      </div>

      <motion.ul
        layout
        className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
      >
        {cards.map((card, i) => (
          <GalleryCardItem key={card.id} card={card} index={i} />
        ))}
      </motion.ul>
    </div>
  )
}

interface GalleryCardItemProps {
  card: GalleryCard
  index: number
}

function GalleryCardItem({ card, index }: GalleryCardItemProps) {
  // Cap stagger so the long tail doesn't feel sluggish.
  const delay = Math.min(index * 0.01, 0.35)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-foreground/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md"
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
    </motion.li>
  )
}
