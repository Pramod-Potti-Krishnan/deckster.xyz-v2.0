"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import {
  AGENT_TEAM,
  type AgentId,
} from "@/lib/marketing/homepage-v2-content"

/**
 * Knowledge-graph connector overlay. Reads each agent card's live
 * bounding rect every frame so the lines + traveling dots track the cards
 * as the user drags them around the pyramid.
 *
 * Coordinates are PIXELS, not viewBox percentages. The viewBox tracks the
 * container's pixel dimensions exactly so a `<circle r="6">` renders as a
 * 6-pixel-radius circle on any aspect ratio — previously the SVG was
 * stretched non-uniformly which turned the pulse dots into ovals.
 */

export type AgentCardRefs = RefObject<Partial<Record<AgentId, HTMLDivElement | null>>>

interface AgentConnectorOverlayProps {
  containerRef: RefObject<HTMLDivElement | null>
  cardRefs: AgentCardRefs
}

type Connection = { from: AgentId; to: AgentId }

const CONNECTIONS: ReadonlyArray<Connection> = [
  // Director routes work down to the three synthesizers
  { from: "director", to: "content_generator" },
  { from: "director", to: "slide_composer" },
  { from: "director", to: "element_generator" },
  // Top-down: each synthesizer routes to its specialists
  { from: "content_generator", to: "researcher" },
  { from: "content_generator", to: "analyst" },
  { from: "slide_composer", to: "visualizer" },
  { from: "element_generator", to: "visualizer" },
  { from: "element_generator", to: "theme_builder" },
  // Feedback edges
  { from: "researcher", to: "director" },
  { from: "analyst", to: "director" },
  { from: "visualizer", to: "content_generator" },
  { from: "theme_builder", to: "content_generator" },
  { from: "theme_builder", to: "slide_composer" },
  // Cross-row laterals
  { from: "researcher", to: "slide_composer" },
  { from: "analyst", to: "visualizer" },
]

function agentColor(id: AgentId): string {
  return AGENT_TEAM.find((a) => a.id === id)?.color ?? "hsl(280, 90%, 75%)"
}

type EdgeState = { x1: number; y1: number; x2: number; y2: number }
type PulseSpec = { duration: number; offset: number; color: string }

// How far inside the card edge to land each endpoint, as a fraction of the
// card's half-extent in the connection's direction.
const EDGE_TUCK = 0.85

export function AgentConnectorOverlay({
  containerRef,
  cardRefs,
}: AgentConnectorOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const lineRefs = useRef<Array<SVGLineElement | null>>([])
  const portFromRefs = useRef<Array<SVGCircleElement | null>>([])
  const portToRefs = useRef<Array<SVGCircleElement | null>>([])
  const pulseARefs = useRef<Array<SVGCircleElement | null>>([])
  const pulseBRefs = useRef<Array<SVGCircleElement | null>>([])
  const edgeStates = useRef<EdgeState[]>([])
  const runningRef = useRef(false)
  const reducedRef = useRef(false)
  const visibleRef = useRef(false)

  // Track the container's pixel dimensions so the SVG viewBox matches —
  // this is what keeps the pulse circles perfectly round regardless of
  // the slide's aspect ratio.
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })

  const pulses = useMemo<PulseSpec[]>(
    () =>
      CONNECTIONS.map((c, i) => ({
        duration: 2400 + (i % 5) * 600,
        offset: i * 280,
        color: agentColor(c.from),
      })),
    [],
  )

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedRef.current = mql.matches
    const onReduceChange = () => {
      reducedRef.current = mql.matches
      if (reducedRef.current) stop()
      else if (visibleRef.current) start()
    }
    mql.addEventListener("change", onReduceChange)

    let rafId = 0

    const measureSize = () => {
      const r = container.getBoundingClientRect()
      setViewSize((prev) => {
        if (Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5) {
          return prev
        }
        return { w: r.width, h: r.height }
      })
    }

    const recomputeEdges = () => {
      const containerRect = container.getBoundingClientRect()
      if (containerRect.width === 0 || containerRect.height === 0) return
      const next: EdgeState[] = []
      for (let i = 0; i < CONNECTIONS.length; i++) {
        const c = CONNECTIONS[i]
        const fromEl = cardRefs.current?.[c.from]
        const toEl = cardRefs.current?.[c.to]
        if (!fromEl || !toEl) {
          next.push({ x1: 0, y1: 0, x2: 0, y2: 0 })
          continue
        }
        const fr = fromEl.getBoundingClientRect()
        const tr = toEl.getBoundingClientRect()
        const fcx = fr.left + fr.width / 2
        const fcy = fr.top + fr.height / 2
        const tcx = tr.left + tr.width / 2
        const tcy = tr.top + tr.height / 2
        const dx = tcx - fcx
        const dy = tcy - fcy
        const dist = Math.hypot(dx, dy)
        if (dist === 0) {
          next.push({ x1: 0, y1: 0, x2: 0, y2: 0 })
          continue
        }
        const ux = dx / dist
        const uy = dy / dist
        const halfA = (Math.abs(ux) * fr.width + Math.abs(uy) * fr.height) / 2
        const halfB = (Math.abs(ux) * tr.width + Math.abs(uy) * tr.height) / 2
        const fromX = fcx + ux * halfA * EDGE_TUCK
        const fromY = fcy + uy * halfA * EDGE_TUCK
        const toX = tcx - ux * halfB * EDGE_TUCK
        const toY = tcy - uy * halfB * EDGE_TUCK
        next.push({
          x1: fromX - containerRect.left,
          y1: fromY - containerRect.top,
          x2: toX - containerRect.left,
          y2: toY - containerRect.top,
        })
      }
      edgeStates.current = next
      for (let i = 0; i < next.length; i++) {
        const e = next[i]
        const line = lineRefs.current[i]
        if (line) {
          line.setAttribute("x1", String(e.x1))
          line.setAttribute("y1", String(e.y1))
          line.setAttribute("x2", String(e.x2))
          line.setAttribute("y2", String(e.y2))
        }
        const p1 = portFromRefs.current[i]
        if (p1) {
          p1.setAttribute("cx", String(e.x1))
          p1.setAttribute("cy", String(e.y1))
        }
        const p2 = portToRefs.current[i]
        if (p2) {
          p2.setAttribute("cx", String(e.x2))
          p2.setAttribute("cy", String(e.y2))
        }
      }
    }

    const tick = (now: number) => {
      if (!runningRef.current) return
      recomputeEdges()
      for (let i = 0; i < CONNECTIONS.length; i++) {
        const e = edgeStates.current[i]
        if (!e) continue
        const p = pulses[i]
        const phaseA = ((now + p.offset) % p.duration) / p.duration
        const phaseB =
          ((now + p.offset + p.duration / 2) % p.duration) / p.duration
        const opA = Math.sin(phaseA * Math.PI)
        const opB = Math.sin(phaseB * Math.PI) * 0.7
        const cA = pulseARefs.current[i]
        if (cA) {
          cA.setAttribute("cx", String(e.x1 + (e.x2 - e.x1) * phaseA))
          cA.setAttribute("cy", String(e.y1 + (e.y2 - e.y1) * phaseA))
          cA.setAttribute("opacity", String(opA))
        }
        const cB = pulseBRefs.current[i]
        if (cB) {
          cB.setAttribute("cx", String(e.x1 + (e.x2 - e.x1) * phaseB))
          cB.setAttribute("cy", String(e.y1 + (e.y2 - e.y1) * phaseB))
          cB.setAttribute("opacity", String(opB))
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    const start = () => {
      if (runningRef.current) return
      if (reducedRef.current) {
        recomputeEdges()
        for (let i = 0; i < CONNECTIONS.length; i++) {
          const cA = pulseARefs.current[i]
          const cB = pulseBRefs.current[i]
          if (cA) cA.setAttribute("opacity", "0")
          if (cB) cB.setAttribute("opacity", "0")
        }
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
      { threshold: 0.02 },
    )
    obs.observe(svg)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (visibleRef.current) start()
    }
    document.addEventListener("visibilitychange", onVisibility)

    // ResizeObserver covers both the initial measurement and any reflow.
    const ro = new ResizeObserver(() => {
      measureSize()
      if (!runningRef.current) recomputeEdges()
    })
    ro.observe(container)

    measureSize()
    recomputeEdges()

    return () => {
      stop()
      obs.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      mql.removeEventListener("change", onReduceChange)
    }
  }, [cardRefs, containerRef, pulses])

  // Pixel sizes — round circles regardless of slide aspect ratio.
  const linePx = 1.4
  const portR = 2.8
  const pulseAR = 5
  const pulseBR = 3.5

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${Math.max(1, viewSize.w)} ${Math.max(1, viewSize.h)}`}
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {CONNECTIONS.map((c, i) => {
        const color = agentColor(c.from)
        return (
          <g key={`edge-${i}`}>
            <line
              ref={(el) => {
                lineRefs.current[i] = el
              }}
              stroke={color}
              strokeWidth={linePx}
              strokeOpacity="0.42"
              strokeLinecap="round"
            />
            <circle
              ref={(el) => {
                portFromRefs.current[i] = el
              }}
              r={portR}
              fill={color}
              opacity="0.85"
            />
            <circle
              ref={(el) => {
                portToRefs.current[i] = el
              }}
              r={portR}
              fill={color}
              opacity="0.85"
            />
          </g>
        )
      })}
      {CONNECTIONS.map((c, i) => {
        const color = agentColor(c.from)
        return (
          <g key={`pulse-${i}`}>
            <circle
              ref={(el) => {
                pulseARefs.current[i] = el
              }}
              r={pulseAR}
              fill={color}
              opacity="0"
            />
            <circle
              ref={(el) => {
                pulseBRefs.current[i] = el
              }}
              r={pulseBR}
              fill={color}
              opacity="0"
            />
          </g>
        )
      })}
    </svg>
  )
}
