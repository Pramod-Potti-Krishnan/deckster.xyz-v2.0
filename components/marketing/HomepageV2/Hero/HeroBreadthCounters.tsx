"use client"

import { motion } from "framer-motion"
import { AnimatedCounter } from "../shared/AnimatedCounter"
import { HERO_COPY, INVENTORY_COUNTS } from "@/lib/marketing/homepage-v2-content"

const ITEMS = [
  {
    count: INVENTORY_COUNTS.elements,
    label: "Element types",
    gradient: "from-[hsl(200,90%,75%)] to-[hsl(220,90%,70%)]",
  },
  {
    count: INVENTORY_COUNTS.charts,
    label: "Chart variants",
    gradient: "from-[hsl(320,90%,75%)] to-[hsl(280,80%,70%)]",
  },
  {
    count: INVENTORY_COUNTS.diagrams,
    label: "Diagram patterns",
    gradient: "from-[hsl(280,80%,75%)] to-[hsl(250,90%,70%)]",
  },
  {
    count: INVENTORY_COUNTS.infographics,
    label: "Infographic templates",
    gradient: "from-[hsl(160,80%,70%)] to-[hsl(200,90%,70%)]",
  },
]

export function HeroBreadthCounters() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <div className="mb-4 flex items-center justify-center gap-3 sm:mb-5">
        <span aria-hidden className="h-px w-8 bg-white/15" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50 sm:text-xs">
          {HERO_COPY.countersEyebrow}
        </span>
        <span aria-hidden className="h-px w-8 bg-white/15" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
      {ITEMS.map((item, i) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.07] sm:p-6"
        >
          <AnimatedCounter
            target={item.count}
            duration={1500 + i * 200}
            className={`block bg-gradient-to-br ${item.gradient} bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl`}
          />
          <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 sm:text-xs">
            {item.label}
          </span>
        </div>
      ))}
      </div>
    </motion.div>
  )
}
