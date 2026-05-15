"use client"

import { useEffect, useMemo, useRef } from "react"

/**
 * Lightning-grid backdrop for the agents slide. Faint static grid of
 * interconnected lines + a handful of zigzag "lightning" paths that draw
 * along grid segments and fade away on randomized cycles. No twinkling
 * dots — the only round circles on this slide should be the pulses
 * travelling between agent cards.
 *
 * Each bolt cycles independently:
 *   0–35 %  draw the path (stroke-dashoffset shrinks to 0)
 *   35–55 % hold the fully-drawn path at full opacity
 *   55–85 % fade out
 *   85–100 % wait, invisible
 *
 * Cycle durations are 3.5–6.5 seconds with negative start offsets so on
 * mount different bolts are at different phases — the slide never has a
 * "blank" frame.
 */

const COLS = 22
const ROWS = 12
const BOLT_COUNT = 7
const SEED = 0xc0ffee

const BOLT_COLORS = [
  "hsl(280, 95%, 78%)",
  "hsl(200, 95%, 78%)",
  "hsl(320, 88%, 78%)",
  "hsl(160, 80%, 72%)",
  "hsl(250, 95%, 78%)",
]

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

type Bolt = {
  d: string
  totalLen: number
  duration: number
  offset: number
  color: string
}

function generateBolts(): Bolt[] {
  const rand = mulberry32(SEED)
  const bolts: Bolt[] = []
  for (let i = 0; i < BOLT_COUNT; i++) {
    // Seeded random start cell + zigzag of 4–6 axis-aligned steps along the grid.
    let cx = Math.floor(rand() * (COLS - 1))
    let cy = Math.floor(rand() * (ROWS - 1))
    const points: Array<[number, number]> = [[cx, cy]]
    let lastDir: "h" | "v" = rand() > 0.5 ? "h" : "v"
    const steps = 4 + Math.floor(rand() * 3)
    for (let s = 0; s < steps; s++) {
      const dir = lastDir === "h" ? "v" : "h"
      const sign = rand() > 0.5 ? 1 : -1
      const dist = (1 + Math.floor(rand() * 3)) * sign
      if (dir === "h") {
        cx = Math.max(0, Math.min(COLS - 1, cx + dist))
      } else {
        cy = Math.max(0, Math.min(ROWS - 1, cy + dist))
      }
      points.push([cx, cy])
      lastDir = dir
    }
    // Skip degenerate bolts where every step clamped to the same cell.
    if (points.every(([x, y]) => x === points[0][0] && y === points[0][1])) {
      continue
    }
    // Coords are normalized 0–100 inside the viewBox.
    const toX = (gx: number) => (gx / (COLS - 1)) * 100
    const toY = (gy: number) => (gy / (ROWS - 1)) * 100
    const d = points
      .map(([gx, gy], idx) => `${idx === 0 ? "M" : "L"} ${toX(gx).toFixed(2)} ${toY(gy).toFixed(2)}`)
      .join(" ")
    let totalLen = 0
    for (let p = 1; p < points.length; p++) {
      const ax = toX(points[p - 1][0])
      const ay = toY(points[p - 1][1])
      const bx = toX(points[p][0])
      const by = toY(points[p][1])
      totalLen += Math.hypot(bx - ax, by - ay)
    }
    bolts.push({
      d,
      totalLen,
      duration: 3500 + rand() * 3000,
      offset: -rand() * 8000,
      color: BOLT_COLORS[Math.floor(rand() * BOLT_COLORS.length)],
    })
  }
  return bolts
}

export function LightningGridBackground() {
  const bolts = useMemo(generateBolts, [])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const boltRefs = useRef<Array<SVGPathElement | null>>([])
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

    const renderFrame = (now: number) => {
      for (let i = 0; i < bolts.length; i++) {
        const b = bolts[i]
        const el = boltRefs.current[i]
        if (!el) continue
        const phase = (((now + b.offset) % b.duration) + b.duration) / b.duration % 1
        let dashOffset = b.totalLen
        let opacity = 0
        if (phase < 0.35) {
          // drawing
          const t = phase / 0.35
          dashOffset = b.totalLen * (1 - t)
          opacity = 0.45 + t * 0.4
        } else if (phase < 0.55) {
          // hold
          dashOffset = 0
          opacity = 0.85
        } else if (phase < 0.85) {
          // fade
          const t = (phase - 0.55) / 0.3
          dashOffset = 0
          opacity = 0.85 * (1 - t)
        } else {
          // hidden
          dashOffset = b.totalLen
          opacity = 0
        }
        el.style.strokeDashoffset = String(dashOffset)
        el.style.opacity = String(opacity)
      }
    }

    const tick = (now: number) => {
      if (!runningRef.current) return
      renderFrame(now)
      rafId = requestAnimationFrame(tick)
    }

    const renderStaticFrame = () => {
      for (const el of boltRefs.current) {
        if (el) {
          el.style.opacity = "0"
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
  }, [bolts])

  // Pre-compute base grid lines as static <line> elements rather than a
  // pattern fill so each horizontal/vertical wire reads as a distinct
  // segment of the "knowledge graph".
  const horizontalLines = Array.from({ length: ROWS }, (_, r) => (r / (ROWS - 1)) * 100)
  const verticalLines = Array.from({ length: COLS }, (_, c) => (c / (COLS - 1)) * 100)

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="lightning-fade" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="lightning-mask">
          <rect width="100" height="100" fill="url(#lightning-fade)" />
        </mask>
      </defs>

      <g mask="url(#lightning-mask)">
        {/* Static grid lines */}
        <g stroke="hsl(220, 70%, 85%)" strokeOpacity="0.07" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
          {horizontalLines.map((y, i) => (
            <line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
          {verticalLines.map((x, i) => (
            <line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" />
          ))}
        </g>

        {/* Lightning bolts. dasharray = totalLen, dashoffset animated from
            totalLen to 0 to "draw" the path, then opacity fades it out. */}
        {bolts.map((b, i) => (
          <path
            key={`bolt-${i}`}
            ref={(el) => {
              boltRefs.current[i] = el
            }}
            d={b.d}
            fill="none"
            stroke={b.color}
            strokeWidth="0.45"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{
              strokeDasharray: b.totalLen,
              strokeDashoffset: b.totalLen,
              opacity: 0,
              filter: `drop-shadow(0 0 1px ${b.color})`,
            }}
          />
        ))}
      </g>
    </svg>
  )
}
