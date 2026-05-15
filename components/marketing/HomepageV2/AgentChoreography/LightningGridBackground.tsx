"use client"

import { useEffect, useRef } from "react"

/**
 * Knowledge-graph backdrop for the agents slide. Two layers:
 *
 *   1. A thin static grid of interconnected lines that's always visible
 *      at a low opacity — the "wires" of the graph.
 *   2. A second copy of that same grid in a brighter cyan, masked by a
 *      moving vertical band so it only shows in the wave's footprint.
 *      The mask rect is animated left → right by rAF every CYCLE_MS, with
 *      the actual sweep taking SWEEP_MS. So the slide cycles
 *      "dark grid → bright wave passes → dark grid → …" once every few
 *      seconds, lighting up the wires as the wave moves across.
 *
 * No bolts, no twinkles — only the moving wave illuminates the grid.
 */

const COLS = 24
const ROWS = 14

const SWEEP_MS = 500 // active sweep duration — the wave itself is brief
const CYCLE_MS = 4000 // total cycle so a wave fires once every ~4 s
const BAND_WIDTH = 30 // viewBox units (0-100), gradient band that slides

const WAVE_COLOR = "hsl(200, 95%, 78%)"

export function LightningGridBackground() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const waveRectRef = useRef<SVGRectElement | null>(null)
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

    const tick = (now: number) => {
      if (!runningRef.current) return
      const phase = (now % CYCLE_MS) / CYCLE_MS
      const activeFraction = SWEEP_MS / CYCLE_MS
      let waveX: number
      if (phase < activeFraction) {
        const t = phase / activeFraction
        // travel from -BAND past +100+BAND so the gradient enters and
        // exits cleanly at both edges
        waveX = -BAND_WIDTH + (100 + BAND_WIDTH * 2) * t
      } else {
        // park well off-screen for the idle window
        waveX = 200
      }
      const rectX = waveX - BAND_WIDTH / 2
      waveRectRef.current?.setAttribute("x", String(rectX))
      rafId = requestAnimationFrame(tick)
    }

    const renderStaticFrame = () => {
      // Park rect off-screen so the bright layer never shows under
      // prefers-reduced-motion.
      waveRectRef.current?.setAttribute("x", "200")
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
  }, [])

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
        {/* Soft horizontal-band gradient — opaque at the centre, fading to
            transparent at the edges so the wave has gentle falloff rather
            than hard borders. */}
        <linearGradient id="wave-alpha" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="wave-mask">
          <rect
            ref={waveRectRef}
            x={-BAND_WIDTH * 3}
            y="0"
            width={BAND_WIDTH}
            height="100"
            fill="url(#wave-alpha)"
          />
        </mask>
        {/* Vignette so the grid fades at the edges of the slide */}
        <radialGradient id="grid-fade" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="grid-fade-mask">
          <rect width="100" height="100" fill="url(#grid-fade)" />
        </mask>
      </defs>

      <g mask="url(#grid-fade-mask)">
        {/* Base grid — thin and faint, always on. */}
        <g
          stroke="hsl(220, 70%, 85%)"
          strokeOpacity="0.06"
          strokeWidth="0.3"
          vectorEffect="non-scaling-stroke"
        >
          {horizontalLines.map((y, i) => (
            <line key={`base-h-${i}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
          {verticalLines.map((x, i) => (
            <line key={`base-v-${i}`} x1={x} y1="0" x2={x} y2="100" />
          ))}
        </g>

        {/* Bright copy of the grid, masked to the wave's footprint so
            only the band-of-grid where the wave currently sits shows
            this colour. */}
        <g
          mask="url(#wave-mask)"
          stroke={WAVE_COLOR}
          strokeOpacity="0.9"
          strokeWidth="0.4"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 0.6px ${WAVE_COLOR})` }}
        >
          {horizontalLines.map((y, i) => (
            <line key={`lit-h-${i}`} x1="0" y1={y} x2="100" y2={y} />
          ))}
          {verticalLines.map((x, i) => (
            <line key={`lit-v-${i}`} x1={x} y1="0" x2={x} y2="100" />
          ))}
        </g>
      </g>
    </svg>
  )
}
