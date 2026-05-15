"use client"

import { useEffect, useMemo, useRef } from "react"
import { AGENT_TEAM } from "@/lib/marketing/homepage-v2-content"

/**
 * Animated SVG overlay layered behind the pyramid rows in
 * AgentChoreographySection. Solid outlined connectors show how the
 * Director and the three synthesizers route work to their specific
 * upstream specialists, with coloured pulses travelling each line.
 *
 * Semantic map:
 *   Director  ──┬─→ Content Generator   (storyteller)
 *               ├─→ Slide Composer      (conductor)
 *               └─→ Element Generator   (builder)
 *   Content Generator ──→ Researcher    (facts to write about)
 *   Content Generator ──→ Analyst       (insights to write about)
 *   Slide Composer    ──→ Visualizer    (decides visual placement)
 *   Element Generator ──→ Visualizer    (renders chart pieces)
 *   Element Generator ──→ Theme Builder (themes the atoms)
 *
 * Layout maths is hard-coded to the deterministic 1/3/4 flex layout in
 * the parent. Each card is `w-full max-w-[260px] flex-1 basis-[220px]`,
 * rows are `flex justify-center` with `gap-4 sm:gap-6`. Coordinates are
 * percentages in a 100×100 viewBox stretched via
 * preserveAspectRatio="none". Anchor points hit the edge of each card,
 * so connectors look like wires plugging into real ports.
 */

type Point = { x: number; y: number }

// Card centres (the rendered card grid the parent produces is symmetric).
// X derived from 3-card centred row → 26/50/74 and 4-card row → 14/38/62/86.
// Y derived from row heights (Director y≈16, middle y≈50, bottom y≈84).
const CARD = {
  director: { x: 50, y: 16 },
  content_generator: { x: 26, y: 50 },
  slide_composer: { x: 50, y: 50 },
  element_generator: { x: 74, y: 50 },
  researcher: { x: 14, y: 84 },
  analyst: { x: 38, y: 84 },
  visualizer: { x: 62, y: 84 },
  theme_builder: { x: 86, y: 84 },
} as const

// Each card is ~6 viewBox units tall (card height ≈ 30% of pyramid height
// / 3 rows ≈ 10% per row, half ≈ 5). Pull the line endpoints in toward
// the card top/bottom so lines visually "plug into" the card edge rather
// than crossing into it.
const CARD_HALF_HEIGHT = 6

function topEdge(c: Point): Point {
  return { x: c.x, y: c.y - CARD_HALF_HEIGHT }
}
function bottomEdge(c: Point): Point {
  return { x: c.x, y: c.y + CARD_HALF_HEIGHT }
}

type Connection = {
  from: Point
  to: Point
  /** Source agent id — used to colour the pulse. */
  source: keyof typeof CARD
}

const CONNECTIONS: ReadonlyArray<Connection> = [
  // Director → three synthesizers in the middle row
  { from: bottomEdge(CARD.director), to: topEdge(CARD.content_generator), source: "director" },
  { from: bottomEdge(CARD.director), to: topEdge(CARD.slide_composer), source: "director" },
  { from: bottomEdge(CARD.director), to: topEdge(CARD.element_generator), source: "director" },
  // Content Generator → Researcher + Analyst (facts + insights to write about)
  { from: bottomEdge(CARD.content_generator), to: topEdge(CARD.researcher), source: "content_generator" },
  { from: bottomEdge(CARD.content_generator), to: topEdge(CARD.analyst), source: "content_generator" },
  // Slide Composer → Visualizer (composer places visuals on the slide)
  { from: bottomEdge(CARD.slide_composer), to: topEdge(CARD.visualizer), source: "slide_composer" },
  // Element Generator → Visualizer + Theme Builder (renders chart pieces, themes atoms)
  { from: bottomEdge(CARD.element_generator), to: topEdge(CARD.visualizer), source: "element_generator" },
  { from: bottomEdge(CARD.element_generator), to: topEdge(CARD.theme_builder), source: "element_generator" },
]

function agentColor(id: keyof typeof CARD): string {
  return AGENT_TEAM.find((a) => a.id === id)?.color ?? "hsl(280, 90%, 75%)"
}

type PulseSpec = {
  duration: number
  offset: number
  color: string
}

function buildPulses(): PulseSpec[] {
  return CONNECTIONS.map((c, i) => ({
    duration: 2800 + (i % 4) * 600,
    offset: i * 420,
    color: agentColor(c.source),
  }))
}

export function AgentConnectorOverlay() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pulseRefs = useRef<Array<SVGCircleElement | null>>([])
  const haloRefs = useRef<Array<SVGCircleElement | null>>([])
  const runningRef = useRef(false)
  const reducedRef = useRef(false)
  const visibleRef = useRef(false)

  const pulses = useMemo(buildPulses, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedRef.current = mql.matches
    const onReduceChange = () => {
      reducedRef.current = mql.matches
      if (reducedRef.current) stop()
      else if (visibleRef.current) start()
    }
    mql.addEventListener("change", onReduceChange)

    let rafId = 0

    const tick = (now: number) => {
      if (!runningRef.current) return
      for (let i = 0; i < CONNECTIONS.length; i++) {
        const c = CONNECTIONS[i]
        const p = pulses[i]
        const phase = ((now + p.offset) % p.duration) / p.duration
        const x = c.from.x + (c.to.x - c.from.x) * phase
        const y = c.from.y + (c.to.y - c.from.y) * phase
        // Brighter at the middle of the trip, fade in/out at endpoints.
        const op = Math.sin(phase * Math.PI)
        const haloOp = op * 0.55
        const coreEl = pulseRefs.current[i]
        const haloEl = haloRefs.current[i]
        if (coreEl) {
          coreEl.setAttribute("cx", String(x))
          coreEl.setAttribute("cy", String(y))
          coreEl.setAttribute("opacity", String(op))
        }
        if (haloEl) {
          haloEl.setAttribute("cx", String(x))
          haloEl.setAttribute("cy", String(y))
          haloEl.setAttribute("opacity", String(haloOp))
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    const renderStaticFrame = () => {
      // Park each pulse at its source endpoint, fully transparent, so the
      // SVG isn't blank for reduced-motion users.
      for (let i = 0; i < CONNECTIONS.length; i++) {
        const c = CONNECTIONS[i]
        const coreEl = pulseRefs.current[i]
        const haloEl = haloRefs.current[i]
        if (coreEl) {
          coreEl.setAttribute("cx", String(c.from.x))
          coreEl.setAttribute("cy", String(c.from.y))
          coreEl.setAttribute("opacity", "0")
        }
        if (haloEl) {
          haloEl.setAttribute("cx", String(c.from.x))
          haloEl.setAttribute("cy", String(c.from.y))
          haloEl.setAttribute("opacity", "0")
        }
      }
    }

    const start = () => {
      if (runningRef.current) return
      if (reducedRef.current) {
        renderStaticFrame()
        return
      }
      runningRef.current = true
      rafId = requestAnimationFrame(tick)
    }
    const stop = () => {
      runningRef.current = false
      if (rafId) cancelAnimationFrame(rafId)
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
        if (entry.isIntersecting) start()
        else stop()
      },
      { threshold: 0.05 },
    )
    obs.observe(svg)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (visibleRef.current) start()
    }
    document.addEventListener("visibilitychange", onVisibility)

    renderStaticFrame()

    return () => {
      stop()
      obs.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      mql.removeEventListener("change", onReduceChange)
    }
  }, [pulses])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <filter id="agent-pulse-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Solid outlined connector lines, coloured subtly with the source
          agent so each cable reads as belonging to its owner. vector-effect
          non-scaling-stroke so the lines stay crisp across resizes. */}
      {CONNECTIONS.map((c, i) => {
        const color = agentColor(c.source)
        return (
          <g key={`line-${i}`}>
            <line
              x1={c.from.x}
              y1={c.from.y}
              x2={c.to.x}
              y2={c.to.y}
              stroke={color}
              strokeWidth="0.35"
              strokeOpacity="0.55"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Tiny ports at each endpoint so the connection visually "plugs in" */}
            <circle cx={c.from.x} cy={c.from.y} r="0.7" fill={color} opacity="0.85" />
            <circle cx={c.to.x} cy={c.to.y} r="0.7" fill={color} opacity="0.85" />
          </g>
        )
      })}

      {/* Traveling pulse halos (large soft glow) */}
      {CONNECTIONS.map((c, i) => (
        <circle
          key={`halo-${i}`}
          ref={(el) => {
            haloRefs.current[i] = el
          }}
          cx={c.from.x}
          cy={c.from.y}
          r="2.2"
          fill={pulses[i].color}
          opacity="0"
          filter="url(#agent-pulse-glow)"
        />
      ))}
      {/* Traveling pulse cores (bright dot) */}
      {CONNECTIONS.map((c, i) => (
        <circle
          key={`core-${i}`}
          ref={(el) => {
            pulseRefs.current[i] = el
          }}
          cx={c.from.x}
          cy={c.from.y}
          r="1.1"
          fill={pulses[i].color}
          opacity="0"
        />
      ))}
    </svg>
  )
}
