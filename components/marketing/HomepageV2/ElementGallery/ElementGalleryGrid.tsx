"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import * as Lucide from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  CATEGORY_LABEL,
  GALLERY_CARDS,
  type GalleryCard,
  type GalleryCategory,
} from "@/lib/marketing/homepage-v2-element-gallery"

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
        className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5"
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
  // Look up the icon by name. Fall back to Square if not found.
  const Icon = (Lucide[card.iconName as keyof typeof Lucide] as
    | LucideIcon
    | undefined) ?? Lucide.Square

  // Stagger the entry animation lightly — but cap the delay so the last
  // cards don't feel sluggish on big lists.
  const delay = Math.min(index * 0.012, 0.4)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      className="group relative flex aspect-[5/4] flex-col justify-between overflow-hidden rounded-xl border border-foreground/10 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md"
    >
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30"
        style={{ backgroundColor: card.color }}
      />
      <div className="relative flex items-start justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${card.color}1f`,
            color: card.color,
            boxShadow: `inset 0 0 0 1px ${card.color}33`,
          }}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {card.badge ? (
          <span className="rounded-full bg-foreground/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/55">
            {card.badge}
          </span>
        ) : null}
      </div>
      <div className="relative">
        <div className="text-sm font-semibold leading-tight text-foreground">
          {card.label}
        </div>
        {card.group ? (
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-foreground/45">
            {card.group}
          </div>
        ) : null}
      </div>
    </motion.li>
  )
}
