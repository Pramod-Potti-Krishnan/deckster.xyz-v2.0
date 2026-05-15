"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowUpRight, Check } from "lucide-react"
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
  CHOREO_COPY,
  type AgentDeep,
} from "@/lib/marketing/homepage-v2-agent-deep"
import { AgentConnectorOverlay } from "./AgentConnectorOverlay"
import { KnowledgeGridBackground } from "./KnowledgeGridBackground"

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

export function AgentChoreographySection() {
  // Container ref bounds the connector overlay and the drag constraints.
  const pyramidRef = useRef<HTMLDivElement | null>(null)
  // One ref per agent, keyed by id. Passed down to PyramidRow so each
  // motion.div card can register itself, and shared with the overlay so it
  // can read live card rects every frame (drag positions update on the
  // same tick).
  const cardRefs = useRef<Partial<Record<AgentId, HTMLDivElement | null>>>({})

  return (
    <section
      id="agents"
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,4%)] pb-6 pt-7 sm:pb-8 sm:pt-9"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_70%_25%/0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(200_70%_25%/0.30),transparent_60%)]" />
        <KnowledgeGridBackground />
      </div>

      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Specialists, not a{" "}
            <span className="bg-gradient-to-r from-[hsl(280,90%,75%)] via-[hsl(320,90%,75%)] to-[hsl(200,95%,75%)] bg-clip-text text-transparent">
              one-size-fits-all model.
            </span>
          </h2>
          <p className="mt-2 text-balance text-sm leading-snug text-white/65 sm:mt-3 sm:text-[15px]">
            {CHOREO_COPY.description}
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
            Drag any agent to rearrange the graph
          </p>
        </div>

        {/* Knowledge-graph pyramid. Big row gaps so the connector overlay
            has room to draw mesh edges that visibly cross between rows. */}
        <div
          ref={pyramidRef}
          className="relative mx-auto mt-6 flex max-w-6xl flex-col items-center gap-10 sm:mt-8 sm:gap-14"
        >
          <AgentConnectorOverlay
            containerRef={pyramidRef}
            cardRefs={cardRefs}
          />
          <PyramidRow ids={TOP_ROW} cardRefs={cardRefs} containerRef={pyramidRef} />
          <PyramidRow ids={MIDDLE_ROW} cardRefs={cardRefs} containerRef={pyramidRef} />
          <PyramidRow ids={BOTTOM_ROW} cardRefs={cardRefs} containerRef={pyramidRef} />
        </div>
      </div>
    </section>
  )
}

function PyramidRow({
  ids,
  cardRefs,
  containerRef,
}: {
  ids: ReadonlyArray<AgentId>
  cardRefs: React.MutableRefObject<Partial<Record<AgentId, HTMLDivElement | null>>>
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="relative z-10 flex w-full flex-wrap items-stretch justify-center gap-4 sm:gap-5">
      {ids.map((id) => {
        const agent = getAgent(id)
        const deep = AGENT_DEEP[id]
        return (
          <motion.div
            key={id}
            ref={(el) => {
              cardRefs.current[id] = el
            }}
            drag
            dragMomentum={false}
            dragElastic={0.15}
            dragConstraints={containerRef}
            whileDrag={{ scale: 1.04, zIndex: 50 }}
            className="relative w-full max-w-[260px] flex-1 basis-[220px] cursor-grab touch-none active:cursor-grabbing"
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
