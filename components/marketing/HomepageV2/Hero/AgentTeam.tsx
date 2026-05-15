"use client"

import { motion } from "framer-motion"
import {
  BarChart3,
  Compass,
  Layers,
  LayoutTemplate,
  Palette,
  PenTool,
  Search,
  TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  AGENT_TEAM,
  type AgentIconName,
} from "@/lib/marketing/homepage-v2-content"
import { fadeUp, staggerChildren } from "../shared/motion-presets"
import { useReducedMotionSafe } from "../shared/useReducedMotionSafe"

const ICONS: Record<AgentIconName, LucideIcon> = {
  Compass,
  Search,
  TrendingUp,
  PenTool,
  BarChart3,
  Palette,
  LayoutTemplate,
  Layers,
}

export function AgentTeam() {
  const reduced = useReducedMotionSafe()

  return (
    <motion.ul
      variants={staggerChildren}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      aria-label="Specialist AI agents"
      className="mx-auto grid w-full max-w-5xl list-none grid-cols-2 gap-3 px-0 sm:gap-3.5 md:grid-cols-4 lg:[grid-template-columns:repeat(12,minmax(0,1fr))]"
    >
      {AGENT_TEAM.map((agent) => {
        const Icon = ICONS[agent.iconName]
        // 8 agents on 12-col lg grid → 2 rows of 4 cards, each col-span-3.
        const lgClasses = "lg:col-span-3"
        return (
          <motion.li
            key={agent.id}
            variants={fadeUp}
            className={`group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.07] ${lgClasses}`}
          >
            <span
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${agent.color}1f`,
                boxShadow: `inset 0 0 0 1px ${agent.color}66, 0 0 22px -4px ${agent.color}66`,
              }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: agent.color }}
                aria-hidden
              />
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5"
              >
                {!reduced ? (
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: agent.color }}
                  />
                ) : null}
                <span
                  className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-[hsl(240,10%,4%)]"
                  style={{ backgroundColor: agent.color }}
                />
              </span>
            </span>

            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold text-white">
                {agent.name}
              </div>
              <div className="text-[11px] leading-snug text-white/55">
                {agent.role}
              </div>
            </div>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
