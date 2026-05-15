"use client"

import { useEffect, useMemo, useRef } from "react"
import { AGENT_TEAM } from "@/lib/marketing/homepage-v2-content"

/**
 * Animated SVG overlay layered behind the pyramid rows in
 * AgentChoreographySection. Draws connector lines between Director, the
 * three middle synthesizers, and the four bottom specialists, with small
 * coloured dots travelling along them — a visual hint at how data flows
 * between agents while they build a slide.
 *
 * Coordinates use a 100×100 viewBox stretched via preserveAspectRatio="none"
 * so the lines anchor to the pyramid layout regardless of viewport width.
 * The positions match the deterministic 1/3/4 flex layout in the parent.
 *
 * Animation pattern is the same rAF + setAttribute approach used in
 * KnowledgeGraphBackground (no React state per frame). IntersectionObserver
 * pauses when off-screen; prefers-reduced-motion renders a single static
 * frame and skips the loop.
 */

type Point = { x: number; y: number }

const TOP = { x: 50, y: 12 } // Director
const MIDDLE: Point[] = [
  { x: 18, y: 50 }, // Content Generator
  { x: 50, y: 50 }, // Slide Composer
  { x: 82, y: 50 }, // Element Generator
]
const BOTTOM: Point[] = [
  { x: 12, y: 88 }, // Researcher
  { x: 38, y: 88 }, // Analyst
  { x: 62, y: 88 }, // Visualizer
  { x: 88, y: 88 }, // Theme Builder
]

// Source-target pairs. The colour of the traveling dot is taken from the
// SOURCE agent so a pulse on a Director-out line is Director-coloured, etc.
type Connection = { a: Point; b: Point; sourceAgentId: string }

const CONNECTIONS: ReadonlyArray<Connection> = [
  // Director → each middle synthesizer
  { a: TOP, b: MIDDLE[0], sourceAgentId: "director" },
  { a: TOP, b: MIDDLE[1], sourceAgentId: "director" },
  { a: TOP, b: MIDDLE[2], sourceAgentId: "director" },
  // Middle → adjacent bottom specialists (so every bottom card has at
  // least one feed from a synthesizer above it)
  { a: MIDDLE[0], b: BOTTOM[0], sourceAgentId: "content_generator" },
  { a: MIDDLE[0], b: BOTTOM[1], sourceAgentId: "content_generator" },
  { a: MIDDLE[1], b: BOTTOM[1], sourceAgentId: "slide_composer" },
  { a: MIDDLE[1], b: BOTTOM[2], sourceAgentId: "slide_composer" },
  { a: MIDDLE[2], b: BOTTOM[2], sourceAgentId: "element_generator" },
  { a: MIDDLE[2], b: BOTTOM[3], sourceAgentId: "element_generator" },
]

function agentColor(id: string): string {
  return AGENT_TEAM.find((a) => a.id === id)?.color ?? "hsl(280, 90%, 75%)"
}

type PulseSpec = {
  duration: number
  offset: number
  color: string
}

function buildPulses(): PulseSpec[] {
  return CONNECTIONS.map((c, i) => ({
    duration: 3200 + (i % 4) * 700,
    offset: i * 480,
    color: agentColor(c.sourceAgentId),
  }))
}

export function AgentConnectorOverlay() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pulseRefs = useRef<Array<SVGCircleElement | null>>([])
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
        const phase = (((now + p.offset) % p.duration) / p.duration)
        const x = c.a.x + (c.b.x - c.a.x) * phase
        const y = c.a.y + (c.b.y - c.a.y) * phase
        const op = Math.sin(phase * Math.PI) * 0.95
        const el = pulseRefs.current[i]
        if (el) {
          el.setAttribute("cx", String(x))
          el.setAttribute("cy", String(y))
          el.setAttribute("opacity", String(op))
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    const renderStaticFrame = () => {
      for (let i = 0; i < CONNECTIONS.length; i++) {
        const el = pulseRefs.current[i]
        if (el) el.setAttribute("opacity", "0")
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
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Static connector lines (subtle so they don't compete with cards) */}
      {CONNECTIONS.map((c, i) => (
        <line
          key={`line-${i}`}
          x1={c.a.x}
          y1={c.a.y}
          x2={c.b.x}
          y2={c.b.y}
          stroke="hsl(220, 80%, 80%)"
          strokeWidth="0.18"
          strokeOpacity="0.25"
          strokeDasharray="0.8 0.6"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Traveling pulses */}
      {CONNECTIONS.map((c, i) => (
        <circle
          key={`pulse-${i}`}
          ref={(el) => {
            pulseRefs.current[i] = el
          }}
          cx={c.a.x}
          cy={c.a.y}
          r="0.65"
          fill={pulses[i].color}
          opacity="0"
          filter="url(#agent-pulse-glow)"
        />
      ))}
    </svg>
  )
}
