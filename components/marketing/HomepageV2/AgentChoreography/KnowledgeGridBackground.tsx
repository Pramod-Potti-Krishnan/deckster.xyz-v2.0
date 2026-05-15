"use client"

import { useMemo } from "react"

/**
 * "Information superhighway" backdrop for the agents slide. Dotted grid +
 * a scattering of data-point dots that softly twinkle via a CSS keyframe.
 * Layered behind the connector overlay and the cards.
 *
 * The grid uses SVG `<pattern>` for crispness at any width; the dots use
 * inline style for the per-element animation delay so each one breathes
 * on its own offset.
 */

const COLS = 32
const ROWS = 18
const POINT_COUNT = 38
const SEED = 0x9e3779b1

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

type Point = { x: number; y: number; delay: number; duration: number; color: string }

const POINT_COLORS = [
  "hsl(200, 95%, 78%)",
  "hsl(280, 90%, 78%)",
  "hsl(320, 85%, 78%)",
  "hsl(160, 80%, 72%)",
]

function generatePoints(): Point[] {
  const rand = mulberry32(SEED)
  const points: Point[] = []
  for (let i = 0; i < POINT_COUNT; i++) {
    const c = Math.floor(rand() * COLS)
    const r = Math.floor(rand() * ROWS)
    points.push({
      x: (c / (COLS - 1)) * 100,
      y: (r / (ROWS - 1)) * 100,
      delay: -rand() * 8,
      duration: 2.8 + rand() * 4.2,
      color: POINT_COLORS[Math.floor(rand() * POINT_COLORS.length)],
    })
  }
  return points
}

export function KnowledgeGridBackground() {
  const points = useMemo(generatePoints, [])

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full motion-reduce:hidden"
    >
      <defs>
        {/* Faint grid */}
        <pattern id="agent-grid" width="3.125" height="5.556" patternUnits="userSpaceOnUse">
          <path
            d="M 3.125 0 L 0 0 L 0 5.556"
            fill="none"
            stroke="hsl(220, 80%, 90%)"
            strokeOpacity="0.07"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
        {/* Soft radial vignette so the grid fades at the edges */}
        <radialGradient id="agent-grid-fade" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="agent-grid-mask">
          <rect width="100" height="100" fill="url(#agent-grid-fade)" />
        </mask>
      </defs>

      <g mask="url(#agent-grid-mask)">
        <rect width="100" height="100" fill="url(#agent-grid)" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="0.25"
            fill={p.color}
            style={{
              animation: `agentgrid-twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </g>
    </svg>
  )
}
