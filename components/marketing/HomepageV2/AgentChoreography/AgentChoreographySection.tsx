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
  type AgentMeta,
} from "@/lib/marketing/homepage-v2-content"
import {
  AGENT_DEEP,
  CHOREO_COPY,
  type AgentDeep,
} from "@/lib/marketing/homepage-v2-agent-deep"

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

// Pyramid podium layout. Director on top, the three "synthesizers" who put a
// slide together in the middle, and the four upstream specialists below.
const TOP_ROW = ["director"] as const
const MIDDLE_ROW = ["content_generator", "slide_composer", "element_generator"] as const
const BOTTOM_ROW = ["researcher", "analyst", "visualizer", "theme_builder"] as const

function getAgent(id: AgentMeta["id"]): AgentMeta {
  const a = AGENT_TEAM.find((x) => x.id === id)
  if (!a) throw new Error(`Agent ${id} missing from AGENT_TEAM`)
  return a
}

export function AgentChoreographySection() {
  return (
    <section
      id="agents"
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,4%)] pb-8 pt-8 sm:pb-10 sm:pt-10"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_70%_25%/0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(200_70%_25%/0.30),transparent_60%)]" />
      </div>

      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Compact inline header. Eyebrow dropped, title shrunk, description
            tightened — agents slide is dense with 8 cards so the header
            stays out of the way. */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {CHOREO_COPY.title}
          </h2>
          <p className="mt-2 text-balance text-sm leading-snug text-white/65 sm:text-[15px]">
            {CHOREO_COPY.description}
          </p>
        </div>

        {/* Podium pyramid: 1 / 3 / 4. All cards share the same fixed width so
            top row is narrowest, bottom row widest. */}
        <div className="mx-auto mt-5 flex max-w-6xl flex-col items-center gap-3 sm:mt-6 sm:gap-4">
          <PyramidRow ids={TOP_ROW} />
          <PyramidRow ids={MIDDLE_ROW} />
          <PyramidRow ids={BOTTOM_ROW} />
        </div>
      </div>
    </section>
  )
}

function PyramidRow({ ids }: { ids: ReadonlyArray<AgentMeta["id"]> }) {
  return (
    <div className="flex w-full flex-wrap items-stretch justify-center gap-4 sm:gap-5">
      {ids.map((id) => {
        const agent = getAgent(id)
        const deep = AGENT_DEEP[id]
        return <AgentPodiumCard key={id} agent={agent} deep={deep} />
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
  const cardClass =
    "group relative flex w-full max-w-[260px] flex-1 basis-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"

  const bullets = deep.capabilities.slice(0, 2)

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
            className="flex items-start gap-1.5 text-[11px] leading-snug text-white/70"
          >
            <Check
              className="mt-0.5 h-3 w-3 shrink-0"
              style={{ color: agent.color }}
              aria-hidden
            />
            <span>{cap}</span>
          </li>
        ))}
      </ul>
    </>
  )

  if (deep.detailHref) {
    return (
      <Link href={deep.detailHref} className={cardClass}>
        {inner}
      </Link>
    )
  }
  return <article className={cardClass}>{inner}</article>
}
