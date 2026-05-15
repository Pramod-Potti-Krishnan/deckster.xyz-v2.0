"use client"

import { useEffect, useMemo, useRef } from "react"

const VIEW_W = 100
const VIEW_H = 70
const NODE_COUNT = 22
const GRID_COLS = 6
const GRID_ROWS = 4
const DRIFT_X = 1.2
const DRIFT_Y = 1.0
const SEED = 1337

const NODE_COLORS = [
  "hsl(280, 90%, 78%)",
  "hsl(200, 95%, 78%)",
  "hsl(320, 88%, 78%)",
  "hsl(250, 92%, 80%)",
]

type GraphNode = {
  id: number
  x: number
  y: number
  phase: number
  speed: number
  scale: number
  color: string
}

type GraphEdge = { a: number; b: number }

type Pulse = {
  edge: number
  offsetMs: number
  durationMs: number
  color: string
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildGraph(): { nodes: GraphNode[]; edges: GraphEdge[]; pulses: Pulse[] } {
  const rand = mulberry32(SEED)
  const nodes: GraphNode[] = []
  for (let i = 0; i < NODE_COUNT; i++) {
    const col = i % GRID_COLS
    const row = Math.floor(i / GRID_COLS)
    const cellW = VIEW_W / GRID_COLS
    const cellH = VIEW_H / GRID_ROWS
    nodes.push({
      id: i,
      x: (col + 0.5) * cellW + (rand() - 0.5) * cellW * 0.55,
      y: (row + 0.5) * cellH + (rand() - 0.5) * cellH * 0.55,
      phase: rand() * Math.PI * 2,
      speed: 0.18 + rand() * 0.22,
      scale: 0.85 + rand() * 0.5,
      color: NODE_COLORS[Math.floor(rand() * NODE_COLORS.length)],
    })
  }

  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes
      .map((n, j) => ({
        j,
        d: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2,
      }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
    for (const { j } of dists) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (!seen.has(key)) {
        seen.add(key)
        edges.push({ a: i, b: j })
      }
    }
  }

  const pulses: Pulse[] = edges.map((_, i) => ({
    edge: i,
    offsetMs: rand() * 8000,
    durationMs: 3800 + rand() * 3200,
    color: NODE_COLORS[i % NODE_COLORS.length],
  }))

  return { nodes, edges, pulses }
}

function driftFor(node: GraphNode, tSec: number): { x: number; y: number } {
  return {
    x: node.x + Math.sin(tSec * node.speed + node.phase) * DRIFT_X,
    y: node.y + Math.cos(tSec * node.speed * 0.8 + node.phase) * DRIFT_Y,
  }
}

export function KnowledgeGraphBackground() {
  const { nodes, edges, pulses } = useMemo(buildGraph, [])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const nodeRefs = useRef<Array<SVGGElement | null>>([])
  const lineRefs = useRef<Array<SVGLineElement | null>>([])
  const pulseRefs = useRef<Array<SVGCircleElement | null>>([])
  const runningRef = useRef(false)
  const reducedRef = useRef(false)
  const visibleRef = useRef(false)

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
    let startedAt = performance.now()

    const tick = (now: number) => {
      if (!runningRef.current) return
      const tSec = (now - startedAt) / 1000

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const { x, y } = driftFor(n, tSec)
        const el = nodeRefs.current[i]
        if (el) el.setAttribute("transform", `translate(${x} ${y}) scale(${n.scale})`)
      }

      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]
        const a = driftFor(nodes[e.a], tSec)
        const b = driftFor(nodes[e.b], tSec)
        const line = lineRefs.current[i]
        if (line) {
          line.setAttribute("x1", String(a.x))
          line.setAttribute("y1", String(a.y))
          line.setAttribute("x2", String(b.x))
          line.setAttribute("y2", String(b.y))
        }
        const p = pulses[i]
        const pulseEl = pulseRefs.current[i]
        if (pulseEl) {
          const phase = (((now + p.offsetMs) % p.durationMs) / p.durationMs)
          const px = a.x + (b.x - a.x) * phase
          const py = a.y + (b.y - a.y) * phase
          const op = Math.sin(phase * Math.PI) * 0.95
          pulseEl.setAttribute("cx", String(px))
          pulseEl.setAttribute("cy", String(py))
          pulseEl.setAttribute("opacity", String(op))
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    const renderStaticFrame = () => {
      const now = performance.now()
      const tSec = (now - startedAt) / 1000
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const { x, y } = driftFor(n, tSec)
        const el = nodeRefs.current[i]
        if (el) el.setAttribute("transform", `translate(${x} ${y}) scale(${n.scale})`)
      }
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]
        const a = driftFor(nodes[e.a], tSec)
        const b = driftFor(nodes[e.b], tSec)
        const line = lineRefs.current[i]
        if (line) {
          line.setAttribute("x1", String(a.x))
          line.setAttribute("y1", String(a.y))
          line.setAttribute("x2", String(b.x))
          line.setAttribute("y2", String(b.y))
        }
        const pulseEl = pulseRefs.current[i]
        if (pulseEl) pulseEl.setAttribute("opacity", "0")
      }
    }

    const start = () => {
      if (runningRef.current) return
      if (reducedRef.current) {
        renderStaticFrame()
        return
      }
      runningRef.current = true
      startedAt = performance.now()
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

    renderStaticFrame()

    return () => {
      stop()
      obs.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      mql.removeEventListener("change", onReduceChange)
    }
  }, [nodes, edges, pulses])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.32] mix-blend-screen motion-reduce:opacity-[0.22]"
      aria-hidden
    >
      <defs>
        <filter id="kg-pulse-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="0.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="kg-node-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.35" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="kg-fade" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="65%" stopColor="white" stopOpacity="0.75" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="kg-mask">
          <rect width={VIEW_W} height={VIEW_H} fill="url(#kg-fade)" />
        </mask>
      </defs>

      <g mask="url(#kg-mask)">
        {edges.map((e, i) => (
          <line
            key={`edge-${i}`}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            x1={nodes[e.a].x}
            y1={nodes[e.a].y}
            x2={nodes[e.b].x}
            y2={nodes[e.b].y}
            stroke="hsl(220, 90%, 80%)"
            strokeWidth="0.08"
            strokeOpacity="0.35"
          />
        ))}

        {nodes.map((n, i) => (
          <g
            key={`node-${i}`}
            ref={(el) => {
              nodeRefs.current[i] = el
            }}
            transform={`translate(${n.x} ${n.y}) scale(${n.scale})`}
            filter="url(#kg-node-glow)"
          >
            <path
              d="M -1.4 -1.7 L 0.7 -1.7 L 1.4 -1.0 L 1.4 1.7 L -1.4 1.7 Z"
              fill="hsl(230, 35%, 12%)"
              fillOpacity="0.85"
              stroke={n.color}
              strokeWidth="0.12"
              strokeOpacity="0.9"
            />
            <path
              d="M 0.7 -1.7 L 0.7 -1.0 L 1.4 -1.0"
              fill="none"
              stroke={n.color}
              strokeWidth="0.1"
              strokeOpacity="0.7"
            />
            <line x1="-0.9" y1="-0.5" x2="0.8" y2="-0.5" stroke={n.color} strokeWidth="0.09" strokeOpacity="0.6" />
            <line x1="-0.9" y1="-0.05" x2="0.6" y2="-0.05" stroke={n.color} strokeWidth="0.09" strokeOpacity="0.55" />
            <line x1="-0.9" y1="0.4" x2="0.8" y2="0.4" stroke={n.color} strokeWidth="0.09" strokeOpacity="0.5" />
            <line x1="-0.9" y1="0.85" x2="0.4" y2="0.85" stroke={n.color} strokeWidth="0.09" strokeOpacity="0.45" />
          </g>
        ))}

        {pulses.map((p, i) => (
          <circle
            key={`pulse-${i}`}
            ref={(el) => {
              pulseRefs.current[i] = el
            }}
            cx={nodes[edges[p.edge].a].x}
            cy={nodes[edges[p.edge].a].y}
            r="0.35"
            fill={p.color}
            opacity="0"
            filter="url(#kg-pulse-glow)"
          />
        ))}
      </g>
    </svg>
  )
}
