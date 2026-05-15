import Link from "next/link"
import { ArrowUpRight, Check } from "lucide-react"
import {
  BarChart3,
  Compass,
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
import { SectionHeader } from "../shared/SectionHeader"

const ICONS: Record<AgentIconName, LucideIcon> = {
  Compass,
  Search,
  TrendingUp,
  PenTool,
  BarChart3,
  Palette,
  LayoutTemplate,
}

export function AgentChoreographySection() {
  return (
    <section
      id="agents"
      className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[hsl(240,10%,4%)] py-16 sm:py-20"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_70%_25%/0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(200_70%_25%/0.30),transparent_60%)]" />
      </div>

      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="dark"
          eyebrow={CHOREO_COPY.eyebrow}
          title={CHOREO_COPY.title}
          description={CHOREO_COPY.description}
        />

        {/* 3 cards on top, 4 cards on bottom — 12-col grid with col-span 4 then 3 */}
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-4 sm:gap-5 md:grid-cols-12">
          {AGENT_TEAM.map((agent, index) => {
            const deep = AGENT_DEEP[agent.id]
            const spanClass = index < 3 ? "md:col-span-4" : "md:col-span-3"
            return (
              <div key={agent.id} className={spanClass}>
                <AgentDeepCard agent={agent} deep={deep} />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

interface AgentDeepCardProps {
  agent: AgentMeta
  deep: AgentDeep
}

function AgentDeepCard({ agent, deep }: AgentDeepCardProps) {
  const Icon = ICONS[agent.iconName]
  const cardClass =
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"

  const inner = (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-45"
        style={{ backgroundColor: agent.color }}
      />
      <header className="relative mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
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
          </span>
          <div>
            <div className="text-base font-semibold leading-tight text-white">
              {agent.name}
            </div>
            <div
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: agent.color }}
            >
              {deep.title}
            </div>
          </div>
        </div>
        {deep.detailHref ? (
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-white/35 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
            aria-hidden
          />
        ) : null}
      </header>

      <p className="relative text-sm leading-relaxed text-white/70">
        {deep.description}
      </p>

      <ul className="relative mt-4 space-y-1.5">
        {deep.capabilities.map((cap) => (
          <li
            key={cap}
            className="flex items-start gap-2 text-[12.5px] leading-snug text-white/75"
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
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
