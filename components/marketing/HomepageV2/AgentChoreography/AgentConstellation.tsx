import Link from "next/link"
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
import { AGENT_DEEP } from "@/lib/marketing/homepage-v2-agent-deep"
import { cn } from "@/lib/utils"

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

function agentById(id: AgentId): AgentMeta {
  const a = AGENT_TEAM.find((x) => x.id === id)
  if (!a) throw new Error(`Agent ${id} missing from AGENT_TEAM`)
  return a
}

/**
 * Radial positions as percentages of the constellation box: Director at the
 * centre, the three "synthesizers" on an inner ring, the four upstream
 * specialists orbiting the outer ring. Cards are absolutely positioned and
 * translated -50%/-50%, so these are card centres.
 */
const POS: Record<AgentId, { x: number; y: number }> = {
  director: { x: 50, y: 50 },
  slide_composer: { x: 50, y: 22 },
  content_generator: { x: 26, y: 68 },
  element_generator: { x: 74, y: 68 },
  researcher: { x: 13, y: 15 },
  analyst: { x: 87, y: 15 },
  theme_builder: { x: 13, y: 85 },
  visualizer: { x: 87, y: 85 },
}

/** Spoke tree: Director → synthesizers → the specialists each one leans on.
 *  Connector is tinted to the child (downstream) agent's colour. */
const CONNECTIONS: ReadonlyArray<[AgentId, AgentId]> = [
  ["director", "slide_composer"],
  ["director", "content_generator"],
  ["director", "element_generator"],
  ["slide_composer", "researcher"],
  ["slide_composer", "analyst"],
  ["content_generator", "theme_builder"],
  ["element_generator", "visualizer"],
]

const MOBILE_ORDER: ReadonlyArray<AgentId> = [
  "content_generator",
  "slide_composer",
  "element_generator",
  "researcher",
  "analyst",
  "visualizer",
  "theme_builder",
]

/**
 * "Meet the team" constellation. Server-rendered (no client JS): pure-CSS
 * hover, CSS-only responsive switch. Desktop shows the radial orbit; below
 * md it falls back to a compact stack (a radial layout can't collapse onto
 * a phone). Full per-agent capabilities live on the /agents detail pages —
 * the cards link there rather than carrying bullets here.
 */
export function AgentConstellation() {
  const ids = Object.keys(POS) as AgentId[]
  return (
    <>
      {/* Desktop: radial orbit. flex-1 fills the slide's remaining height so
          the constellation always fits the viewport instead of overflowing. */}
      <div className="relative mx-auto hidden min-h-0 w-full max-w-4xl flex-1 md:block">
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {CONNECTIONS.map(([from, to]) => (
            <line
              key={`${from}-${to}`}
              x1={POS[from].x}
              y1={POS[from].y}
              x2={POS[to].x}
              y2={POS[to].y}
              stroke={agentById(to).color}
              strokeOpacity={0.25}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {ids.map((id) => (
          <div
            key={id}
            className="absolute z-10 w-[160px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${POS[id].x}%`, top: `${POS[id].y}%` }}
          >
            <AgentCard id={id} featured={id === "director"} />
          </div>
        ))}
      </div>

      {/* Mobile: Director on top, the rest in a compact 2-col grid. */}
      <div className="mx-auto mt-6 w-full max-w-md md:hidden">
        <AgentCard id="director" featured className="mb-2.5" />
        <div className="grid grid-cols-2 gap-2.5">
          {MOBILE_ORDER.map((id) => (
            <AgentCard key={id} id={id} />
          ))}
        </div>
      </div>
    </>
  )
}

function AgentCard({
  id,
  featured = false,
  className,
}: {
  id: AgentId
  featured?: boolean
  className?: string
}) {
  const agent = agentById(id)
  const deep = AGENT_DEEP[id]
  const Icon = ICONS[agent.iconName]

  return (
    <Link
      href={deep.detailHref ?? "/agents"}
      className={cn("group block", className)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white/[0.05] px-3 py-2.5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]",
          featured
            ? "border-white/25 ring-1 ring-white/10"
            : "border-white/10 hover:border-white/25",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
          style={{ backgroundColor: agent.color }}
        />
        <div className="relative flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${agent.color}1f`,
              boxShadow: `inset 0 0 0 1px ${agent.color}66`,
            }}
          >
            <Icon className="h-4 w-4" style={{ color: agent.color }} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-white">
              {agent.name}
            </div>
            <div
              className="truncate text-[10px] font-medium uppercase tracking-wider"
              style={{ color: agent.color }}
            >
              {deep.title}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
