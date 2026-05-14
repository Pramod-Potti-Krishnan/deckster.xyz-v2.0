"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  ELEMENT_TYPES,
  type ElementAccent,
} from "@/lib/marketing/homepage-v2-content"
import { useReducedMotionSafe } from "../shared/useReducedMotionSafe"

const ACCENT_HEX: Record<ElementAccent, string> = {
  indigo: "#818cf8",
  emerald: "#34d399",
  blue: "#60a5fa",
  cyan: "#22d3ee",
  rose: "#fb7185",
  amber: "#fbbf24",
  violet: "#a78bfa",
  magenta: "#f472b6",
  purple: "#c084fc",
}

const ROTATIONS = [-2.5, 1.8, -1.4, 2.6, -2.1, 1.2, -1.9, 2.4, -1.6]

type SpecProps = { color: string }

function SpecTextBox({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <rect
        x="6"
        y="6"
        width="108"
        height="68"
        rx="8"
        fill="none"
        stroke={color}
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <rect x="14" y="14" width="48" height="6" rx="2" fill={color} />
      <rect x="14" y="28" width="92" height="3" rx="1.5" fill={color} fillOpacity="0.5" />
      <rect x="14" y="36" width="84" height="3" rx="1.5" fill={color} fillOpacity="0.4" />
      <rect x="14" y="44" width="78" height="3" rx="1.5" fill={color} fillOpacity="0.3" />
      <rect x="14" y="52" width="62" height="3" rx="1.5" fill={color} fillOpacity="0.25" />
    </svg>
  )
}

function SpecMetrics({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <rect
        x="6"
        y="6"
        width="108"
        height="68"
        rx="8"
        fill={color}
        fillOpacity="0.08"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <text
        x="60"
        y="44"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill={color}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        $2.4M
      </text>
      <text
        x="60"
        y="60"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        fill={color}
        fillOpacity="0.7"
        letterSpacing="1.2"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        REVENUE Q3
      </text>
      <path
        d="M88 22 l4 -4 l4 4"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SpecTable({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <rect
        x="6"
        y="6"
        width="108"
        height="68"
        rx="6"
        fill="none"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <rect x="6" y="6" width="108" height="14" rx="6" fill={color} fillOpacity="0.18" />
      <line x1="42" y1="6" x2="42" y2="74" stroke={color} strokeOpacity="0.2" />
      <line x1="78" y1="6" x2="78" y2="74" stroke={color} strokeOpacity="0.2" />
      <line x1="6" y1="32" x2="114" y2="32" stroke={color} strokeOpacity="0.2" />
      <line x1="6" y1="48" x2="114" y2="48" stroke={color} strokeOpacity="0.2" />
      <line x1="6" y1="64" x2="114" y2="64" stroke={color} strokeOpacity="0.2" />
      <circle cx="20" cy="13" r="1.8" fill={color} />
      <circle cx="56" cy="13" r="1.8" fill={color} />
      <circle cx="92" cy="13" r="1.8" fill={color} />
      <rect x="14" y="38" width="22" height="3" rx="1.5" fill={color} fillOpacity="0.45" />
      <rect x="50" y="38" width="22" height="3" rx="1.5" fill={color} fillOpacity="0.45" />
      <rect x="86" y="38" width="22" height="3" rx="1.5" fill={color} fillOpacity="0.45" />
      <rect x="14" y="54" width="22" height="3" rx="1.5" fill={color} fillOpacity="0.3" />
      <rect x="50" y="54" width="22" height="3" rx="1.5" fill={color} fillOpacity="0.3" />
      <rect x="86" y="54" width="22" height="3" rx="1.5" fill={color} fillOpacity="0.3" />
    </svg>
  )
}

function SpecChart({ color }: SpecProps) {
  const cx = 60
  const cy = 40
  const r = 26
  const arc = (a1: number, a2: number) => {
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const large = a2 - a1 > Math.PI ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
  }
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <path d={arc(-Math.PI / 2, Math.PI / 4)} fill={color} />
      <path d={arc(Math.PI / 4, (Math.PI * 3) / 4)} fill={color} fillOpacity="0.7" />
      <path d={arc((Math.PI * 3) / 4, (Math.PI * 5) / 4)} fill={color} fillOpacity="0.5" />
      <path d={arc((Math.PI * 5) / 4, (Math.PI * 3) / 2)} fill={color} fillOpacity="0.32" />
      <circle cx={cx} cy={cy} r="11" fill="hsl(240, 10%, 6%)" />
    </svg>
  )
}

function SpecImage({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <rect
        x="6"
        y="6"
        width="108"
        height="68"
        rx="8"
        fill={color}
        fillOpacity="0.12"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <circle cx="38" cy="30" r="8" fill={color} fillOpacity="0.95" />
      <path
        d="M6 60 L32 36 L52 50 L78 26 L114 60 L114 74 L6 74 Z"
        fill={color}
        fillOpacity="0.5"
      />
      <path
        d="M6 64 L26 52 L42 58 L62 44 L82 56 L114 50 L114 74 L6 74 Z"
        fill={color}
        fillOpacity="0.75"
      />
    </svg>
  )
}

function SpecIconLabel({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <circle
        cx="32"
        cy="40"
        r="16"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <path
        d="M32 30 l3 6 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1 z"
        fill={color}
      />
      <rect x="56" y="32" width="56" height="6" rx="2" fill={color} fillOpacity="0.85" />
      <rect x="56" y="44" width="42" height="4" rx="2" fill={color} fillOpacity="0.5" />
    </svg>
  )
}

function SpecShape({ color }: SpecProps) {
  const cx = 60
  const cy = 40
  const r = 26
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(" ")
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <polygon
        points={pts}
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <polygon
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="0.6"
        strokeOpacity="0.4"
        transform={`rotate(15 ${cx} ${cy})`}
      />
    </svg>
  )
}

function SpecInfographic({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <polygon points="60,12 72,24 48,24" fill={color} fillOpacity="0.95" />
      <polygon points="48,26 72,26 80,40 40,40" fill={color} fillOpacity="0.7" />
      <polygon points="40,42 80,42 88,56 32,56" fill={color} fillOpacity="0.5" />
      <polygon points="32,58 88,58 96,72 24,72" fill={color} fillOpacity="0.32" />
    </svg>
  )
}

function SpecDiagram({ color }: SpecProps) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full">
      <rect
        x="6"
        y="32"
        width="28"
        height="16"
        rx="3"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <rect
        x="46"
        y="32"
        width="28"
        height="16"
        rx="3"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <rect
        x="86"
        y="32"
        width="28"
        height="16"
        rx="3"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <line x1="34" y1="40" x2="44" y2="40" stroke={color} strokeWidth="1.5" />
      <polygon points="44,38 46,40 44,42" fill={color} />
      <line x1="74" y1="40" x2="84" y2="40" stroke={color} strokeWidth="1.5" />
      <polygon points="84,38 86,40 84,42" fill={color} />
    </svg>
  )
}

const RENDERERS: Record<string, React.FC<SpecProps>> = {
  TEXT_BOX: SpecTextBox,
  METRICS: SpecMetrics,
  TABLE: SpecTable,
  CHART: SpecChart,
  IMAGE: SpecImage,
  ICON_LABEL: SpecIconLabel,
  SHAPE: SpecShape,
  INFOGRAPHIC: SpecInfographic,
  DIAGRAM: SpecDiagram,
}

export function HeroSpecimens() {
  const reduced = useReducedMotionSafe()

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-9 lg:gap-3">
      {ELEMENT_TYPES.map((el, i) => {
        const Renderer = RENDERERS[el.id]
        const color = ACCENT_HEX[el.accent]
        return (
          <motion.div
            key={el.id}
            className={cn(
              "group relative aspect-[4/3] rounded-xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-md",
              "transition-[border-color,box-shadow] duration-200 hover:border-white/30",
            )}
            style={{
              rotate: `${ROTATIONS[i] ?? 0}deg`,
              boxShadow: `inset 0 0 0 1px ${color}30, 0 14px 32px -14px ${color}55`,
            }}
            initial={false}
            animate={
              reduced
                ? undefined
                : { y: [0, -4, 0, 4, 0] }
            }
            transition={
              reduced
                ? undefined
                : {
                    duration: 6 + (i % 3),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.25,
                  }
            }
            whileHover={{
              y: -8,
              scale: 1.05,
              transition: { duration: 0.2, ease: "easeOut" },
            }}
            aria-label={el.label}
          >
            <Renderer color={color} />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(240,10%,6%)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/85 opacity-0 ring-1 ring-white/10 transition-opacity group-hover:opacity-100"
            >
              {el.id}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
