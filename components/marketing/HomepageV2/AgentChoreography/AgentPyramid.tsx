"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowUpRight, Check, GripVertical } from "lucide-react"
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
  type AgentId,
  type AgentMeta,
} from "@/lib/marketing/homepage-v2-content"
import {
  AGENT_DEEP,
  type AgentDeep,
} from "@/lib/marketing/homepage-v2-agent-deep"
import { AgentConnectorOverlay } from "./AgentConnectorOverlay"

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

// Pyramid podium layout. Director on top, the three "synthesizers" who put
// a slide together in the middle, and the four upstream specialists below.
const TOP_ROW: ReadonlyArray<AgentId> = ["director"]
const MIDDLE_ROW: ReadonlyArray<AgentId> = [
  "content_generator",
  "slide_composer",
  "element_generator",
]
const BOTTOM_ROW: ReadonlyArray<AgentId> = [
  "researcher",
  "analyst",
  "visualizer",
  "theme_builder",
]

function getAgent(id: AgentId): AgentMeta {
  const a = AGENT_TEAM.find((x) => x.id === id)
  if (!a) throw new Error(`Agent ${id} missing from AGENT_TEAM`)
  return a
}

/**
 * Drag is a desktop-only easter egg. On touch devices the cards must NOT be
 * draggable: framer-motion's drag needs `touch-none`, which swallows touch
 * scrolling — on a full-viewport snap slide that means a thumb landing on
 * the pyramid can't move the page at all. Renders false until mounted so
 * the server and first client paint agree.
 */
function useCanDrag(): boolean {
  const [canDrag, setCanDrag] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 1024px)",
    )
    const update = () => setCanDrag(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return canDrag
}

/**
 * The interactive agent pyramid — draggable cards + the live connector
 * overlay. Split out of AgentChoreographySection so this framer-motion-heavy
 * tree (drag physics, per-frame SVG mesh) loads as its own below-the-fold
 * chunk via AgentPyramidLoader.
 */
export function AgentPyramid() {
  // Container ref bounds the connector overlay and the drag constraints.
  const pyramidRef = useRef<HTMLDivElement | null>(null)
  // One ref per agent, keyed by id. Passed down to PyramidRow so each
  // motion.div card can register itself, and shared with the overlay so it
  // can read live card rects every frame (drag positions update on the
  // same tick).
  const cardRefs = useRef<Partial<Record<AgentId, HTMLDivElement | null>>>({})
  const canDrag = useCanDrag()
  const [hasDragged, setHasDragged] = useState(false)

  return (
    <>
      {/* Knowledge-graph pyramid. Big row gaps so the connector overlay
          has room to draw mesh edges that visibly cross between rows. */}
      <div
        ref={pyramidRef}
        className="relative mx-auto mt-6 flex max-w-6xl flex-col items-center gap-9 sm:mt-8 sm:gap-[50px]"
      >
        <AgentConnectorOverlay containerRef={pyramidRef} cardRefs={cardRefs} />
        <PyramidRow ids={TOP_ROW} cardRefs={cardRefs} containerRef={pyramidRef} offsets={[0]} canDrag={canDrag} onDragStart={() => setHasDragged(true)} />
        <PyramidRow ids={MIDDLE_ROW} cardRefs={cardRefs} containerRef={pyramidRef} offsets={[6, -4, 8]} canDrag={canDrag} onDragStart={() => setHasDragged(true)} />
        <PyramidRow ids={BOTTOM_ROW} cardRefs={cardRefs} containerRef={pyramidRef} offsets={[-3, 7, -5, 4]} canDrag={canDrag} onDragStart={() => setHasDragged(true)} />
      </div>

      {/* Drag affordance — only where drag is enabled, gone after the
          visitor discovers it. */}
      {canDrag ? (
        <p
          aria-hidden
          className={`mt-6 flex items-center justify-center gap-1.5 text-xs text-white/40 transition-opacity duration-500 ${
            hasDragged ? "opacity-0" : "opacity-100"
          }`}
        >
          <GripVertical className="h-3.5 w-3.5" />
          Drag any card — the connections follow.
        </p>
      ) : null}
    </>
  )
}

function PyramidRow({
  ids,
  cardRefs,
  containerRef,
  offsets = [],
  canDrag,
  onDragStart,
}: {
  ids: ReadonlyArray<AgentId>
  cardRefs: React.MutableRefObject<Partial<Record<AgentId, HTMLDivElement | null>>>
  containerRef: React.RefObject<HTMLDivElement | null>
  offsets?: ReadonlyArray<number>
  canDrag: boolean
  onDragStart: () => void
}) {
  return (
    <div className="relative z-10 flex w-full flex-wrap items-stretch justify-center gap-4 sm:gap-5">
      {ids.map((id, i) => {
        const agent = getAgent(id)
        const deep = AGENT_DEEP[id]
        const yOffset = offsets[i] ?? 0
        return (
          <motion.div
            key={id}
            ref={(el) => {
              cardRefs.current[id] = el
            }}
            style={{ translateY: yOffset }}
            drag={canDrag}
            dragMomentum={false}
            dragElastic={0.15}
            dragConstraints={containerRef}
            whileDrag={{ scale: 1.04, zIndex: 50 }}
            onDragStart={onDragStart}
            className={`relative w-full max-w-[260px] flex-1 basis-[220px] ${
              canDrag ? "cursor-grab touch-none active:cursor-grabbing" : ""
            }`}
          >
            <AgentPodiumCard agent={agent} deep={deep} />
          </motion.div>
        )
      })}
    </div>
  )
}

interface AgentPodiumCardProps {
  agent: AgentMeta
  deep: AgentDeep
}

function AgentPodiumCard({ agent, deep }: AgentPodiumCardProps) {
  const Icon = ICONS[agent.iconName]
  // Card lives inside a draggable wrapper — keep h-full so it stretches
  // to the wrapper's height, but drop the hover translate (it conflicts
  // with framer-motion's drag transform).
  const cardClass =
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.07]"

  const bullets = deep.capabilities.slice(0, 3)

  const inner = (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-45"
        style={{ backgroundColor: agent.color }}
      />
      <header className="relative mb-1.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${agent.color}1f`,
              boxShadow: `inset 0 0 0 1px ${agent.color}66, 0 0 16px -4px ${agent.color}66`,
            }}
          >
            <Icon
              className="h-3.5 w-3.5"
              style={{ color: agent.color }}
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-white">
              {agent.name}
            </div>
            <div
              className="truncate text-[9.5px] font-medium uppercase tracking-wider"
              style={{ color: agent.color }}
            >
              {deep.title}
            </div>
          </div>
        </div>
        {deep.detailHref ? (
          <ArrowUpRight
            className="h-3 w-3 shrink-0 text-white/35 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
            aria-hidden
          />
        ) : null}
      </header>

      <ul className="relative mt-1 space-y-0.5">
        {bullets.map((cap) => (
          <li
            key={cap}
            className="flex items-center gap-1.5 text-[11px] leading-snug text-white/75"
          >
            <Check
              className="h-3 w-3 shrink-0"
              style={{ color: agent.color }}
              aria-hidden
            />
            <span className="truncate">{cap}</span>
          </li>
        ))}
      </ul>
    </>
  )

  if (deep.detailHref) {
    return (
      <Link
        href={deep.detailHref}
        className={cardClass}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        {inner}
      </Link>
    )
  }
  return <article className={cardClass}>{inner}</article>
}
