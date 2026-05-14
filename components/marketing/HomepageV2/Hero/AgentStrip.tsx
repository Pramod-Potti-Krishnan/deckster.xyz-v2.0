"use client"

import { motion } from "framer-motion"
import { BarChart3, Compass, Palette, Type } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AGENT_TEAM } from "@/lib/marketing/homepage-v2-content"
import { useReducedMotionSafe } from "../shared/useReducedMotionSafe"

const ICONS: Record<string, LucideIcon> = {
  Compass,
  Type,
  BarChart3,
  Palette,
}

export function AgentStrip() {
  const reduced = useReducedMotionSafe()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
      className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4"
    >
      {AGENT_TEAM.map((agent) => {
        const Icon = ICONS[agent.iconName]
        return (
          <div
            key={agent.id}
            className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.07]"
          >
            <span
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${agent.color}1f`,
                boxShadow: `inset 0 0 0 1px ${agent.color}66, 0 0 18px -2px ${agent.color}66`,
              }}
            >
              <Icon className="h-4 w-4" style={{ color: agent.color }} aria-hidden />
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
              <div className="truncate text-[11px] uppercase tracking-wider text-white/50">
                {agent.role}
              </div>
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}
