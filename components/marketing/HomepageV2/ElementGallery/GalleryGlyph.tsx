/**
 * Bespoke SVG glyphs for the ElementGallery cards.
 *
 * Each glyph is a small abstract representation of the actual shape — a real
 * pyramid for "Pyramid", a real funnel for "Funnel", overlapping circles for
 * "Venn", actual bars for "Bar Chart", and so on. Generic lucide icons are
 * intentionally NOT used here: the gallery's job is to *show* the variety,
 * not to label it.
 *
 * Every glyph renders inside a 64x64 viewBox, takes a single `color` prop,
 * and uses no external dependencies.
 */

import type { ReactElement } from "react"
import type { GalleryCard } from "@/lib/marketing/homepage-v2-element-gallery"

interface GlyphProps {
  card: GalleryCard
  color: string
}

const VB = "0 0 64 64"

export function GalleryGlyph({ card, color }: GlyphProps) {
  return (
    <svg
      viewBox={VB}
      className="h-full w-full"
      role="img"
      aria-label={card.label}
      preserveAspectRatio="xMidYMid meet"
    >
      <Paint card={card} color={color} />
    </svg>
  )
}

function Paint({
  card,
  color,
}: {
  card: GalleryCard
  color: string
}) {
  const key = card.glyphKey

  // ---- Charts -------------------------------------------------------------
  if (card.category === "chart") {
    if (key.startsWith("bar_horizontal")) return <BarHorizontal color={color} />
    if (key === "bar_grouped") return <BarGrouped color={color} />
    if (key === "bar_stacked") return <BarStacked color={color} />
    if (key === "waterfall") return <Waterfall color={color} />
    if (key.startsWith("bar_")) return <BarVertical color={color} />
    if (key === "line") return <LineChart color={color} />
    if (key === "area") return <AreaChart color={color} stacked={false} />
    if (key === "area_stacked") return <AreaChart color={color} stacked />
    if (key === "pie") return <Pie color={color} />
    if (key === "doughnut") return <Donut color={color} />
    if (key === "polar_area") return <PolarArea color={color} />
    if (key === "scatter") return <Scatter color={color} />
    if (key === "bubble") return <Bubble color={color} />
    if (key === "radar") return <Radar color={color} />
    if (key === "d3_treemap") return <Treemap color={color} />
    if (key === "d3_sunburst") return <Sunburst color={color} />
    if (key === "d3_choropleth_usa") return <Choropleth color={color} />
    if (key === "d3_sankey") return <Sankey color={color} />
    return <BarVertical color={color} />
  }

  // ---- Diagrams (8 real Text Labs subtypes) -------------------------------
  if (card.category === "diagram") {
    switch (key) {
      case "code_display":
        return <CodeDisplay color={color} />
      case "cloud_architecture":
        return <CloudArchitecture color={color} />
      case "logical_architecture":
        return <LogicalArchitecture color={color} />
      case "data_architecture":
        return <DataArchitecture color={color} />
      case "idea_board":
        return <IdeaBoard color={color} />
      case "kanban_board":
        return <KanbanBoard color={color} />
      case "gantt_chart":
        return <Gantt color={color} />
      case "chevron_maturity":
        return <ChevronMaturity color={color} />
      default:
        return <CloudArchitecture color={color} />
    }
  }

  // ---- Infographics (examples — generative module ships unlimited) --------
  if (card.category === "infographic") {
    switch (key) {
      case "pyramid":
        return <Pyramid n={4} color={color} />
      case "funnel":
        return <Funnel n={4} color={color} />
      case "hexagon":
        return <Honeycomb n={6} color={color} />
      case "concentric":
        return <Concentric color={color} />
      case "cycle":
        return <Cycle n={4} color={color} />
      case "timeline":
        return <TimelineHorizontal color={color} />
      case "ladder":
        return <Ladder color={color} />
      case "rocket":
        return <Rocket color={color} />
      case "tree":
        return <Tree color={color} />
      case "ship":
        return <Ship color={color} />
      case "rail":
        return <Rail color={color} />
      case "anything":
        return <Anything color={color} />
      default:
        return <Concentric color={color} />
    }
  }

  // ---- Element types ------------------------------------------------------
  switch (key) {
    case "TEXT_BOX":
      return <TextBox color={color} />
    case "METRICS":
      return <Statistics color={color} />
    case "TABLE":
      return <Table color={color} />
    case "CHART":
      return <BarVertical color={color} />
    case "IMAGE":
      return <ImageGlyph color={color} />
    case "ICON_LABEL":
      return <IconLabel color={color} />
    case "SHAPE":
      return <Shape color={color} />
    case "INFOGRAPHIC":
      return <Concentric color={color} />
    case "DIAGRAM":
      return <CloudArchitecture color={color} />
    default:
      return <Shape color={color} />
  }
}

// ---------------------------------------------------------------------------
// Shared styling helpers
// ---------------------------------------------------------------------------

function fillSoft(color: string, alpha = 0.18) {
  // Convert any hex color to an rgba with the given alpha. Falls back to the
  // raw color when the input isn't a 7-char hex.
  if (color.length === 7 && color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return color
}

const STROKE = 2

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function BarVertical({ color }: { color: string }) {
  const heights = [22, 34, 18, 40, 28]
  const w = 7
  const gap = 3
  const totalW = heights.length * w + (heights.length - 1) * gap
  const startX = (64 - totalW) / 2
  return (
    <g>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={startX + i * (w + gap)}
          y={56 - h}
          width={w}
          height={h}
          rx={1.5}
          fill={color}
          opacity={0.85}
        />
      ))}
      <line x1="6" y1="56" x2="58" y2="56" stroke={color} strokeOpacity={0.4} strokeWidth={1} />
    </g>
  )
}

function BarHorizontal({ color }: { color: string }) {
  const widths = [40, 28, 50, 22, 36]
  const h = 5
  const gap = 3
  const totalH = widths.length * h + (widths.length - 1) * gap
  const startY = (64 - totalH) / 2
  return (
    <g>
      {widths.map((w, i) => (
        <rect
          key={i}
          x={8}
          y={startY + i * (h + gap)}
          width={w}
          height={h}
          rx={1.5}
          fill={color}
          opacity={0.85}
        />
      ))}
      <line x1="8" y1="6" x2="8" y2="58" stroke={color} strokeOpacity={0.4} strokeWidth={1} />
    </g>
  )
}

function BarGrouped({ color }: { color: string }) {
  const groups = [
    [22, 30],
    [34, 24],
    [18, 28],
  ]
  const groupW = 14
  const gap = 4
  const totalW = groups.length * groupW + (groups.length - 1) * gap
  const startX = (64 - totalW) / 2
  return (
    <g>
      {groups.map((pair, i) =>
        pair.map((h, j) => (
          <rect
            key={`${i}-${j}`}
            x={startX + i * (groupW + gap) + j * 7}
            y={56 - h}
            width={6}
            height={h}
            rx={1}
            fill={color}
            opacity={j === 0 ? 0.9 : 0.55}
          />
        )),
      )}
    </g>
  )
}

function BarStacked({ color }: { color: string }) {
  const stacks = [
    [12, 8, 6],
    [18, 6, 10],
    [10, 14, 8],
    [16, 8, 12],
  ]
  const w = 9
  const gap = 4
  const totalW = stacks.length * w + (stacks.length - 1) * gap
  const startX = (64 - totalW) / 2
  return (
    <g>
      {stacks.map((stack, i) => {
        let y = 56
        return stack.map((h, j) => {
          y -= h
          return (
            <rect
              key={`${i}-${j}`}
              x={startX + i * (w + gap)}
              y={y}
              width={w}
              height={h - 0.5}
              fill={color}
              opacity={[0.95, 0.7, 0.45][j] ?? 0.45}
            />
          )
        })
      })}
    </g>
  )
}

function Waterfall({ color }: { color: string }) {
  // 5 floating bars, climb then dip then climb
  const bars = [
    { y: 40, h: 16 },
    { y: 28, h: 12 },
    { y: 22, h: 6 },
    { y: 26, h: 4, neg: true },
    { y: 14, h: 12 },
  ]
  const w = 8
  const gap = 4
  const totalW = bars.length * w + (bars.length - 1) * gap
  const startX = (64 - totalW) / 2
  return (
    <g>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={startX + i * (w + gap)}
          y={b.y}
          width={w}
          height={b.h}
          rx={1}
          fill={color}
          opacity={b.neg ? 0.45 : 0.85}
        />
      ))}
    </g>
  )
}

function LineChart({ color }: { color: string }) {
  return (
    <g>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        points="6,46 18,38 28,42 38,24 50,30 58,16"
      />
      {[
        [6, 46],
        [18, 38],
        [28, 42],
        [38, 24],
        [50, 30],
        [58, 16],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill={color} />
      ))}
    </g>
  )
}

function AreaChart({ color, stacked }: { color: string; stacked: boolean }) {
  const top = "6,46 18,38 28,42 38,24 50,30 58,16"
  const bottom = "58,56 6,56"
  return (
    <g>
      <polygon points={`${top} ${bottom}`} fill={color} opacity={0.35} />
      {stacked ? (
        <polygon
          points="6,52 18,48 28,50 38,42 50,46 58,38 58,56 6,56"
          fill={color}
          opacity={0.6}
        />
      ) : null}
      <polyline
        points={top}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  )
}

function Pie({ color }: { color: string }) {
  return (
    <g transform="translate(32 32)">
      <circle r="20" fill={fillSoft(color, 0.28)} stroke={color} strokeWidth={1} />
      <path d={describeArc(0, 0, 20, 0, 130)} fill={color} opacity={0.9} />
      <path d={describeArc(0, 0, 20, 130, 220)} fill={color} opacity={0.6} />
    </g>
  )
}

function Donut({ color }: { color: string }) {
  return (
    <g transform="translate(32 32)">
      <circle r="20" fill="none" stroke={color} strokeWidth={6} opacity={0.35} />
      <circle
        r="20"
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray="60 130"
        transform="rotate(-90)"
      />
    </g>
  )
}

function PolarArea({ color }: { color: string }) {
  const radii = [16, 10, 18, 14, 8, 20]
  return (
    <g transform="translate(32 32)">
      <circle r="22" fill="none" stroke={color} strokeWidth={0.5} opacity={0.3} />
      <circle r="14" fill="none" stroke={color} strokeWidth={0.5} opacity={0.2} />
      {radii.map((r, i) => {
        const start = (i * 60 - 90) * (Math.PI / 180)
        const end = ((i + 1) * 60 - 90) * (Math.PI / 180)
        const x1 = Math.cos(start) * r
        const y1 = Math.sin(start) * r
        const x2 = Math.cos(end) * r
        const y2 = Math.sin(end) * r
        const largeArc = end - start > Math.PI ? 1 : 0
        return (
          <path
            key={i}
            d={`M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
            fill={color}
            opacity={0.45 + (i % 3) * 0.15}
          />
        )
      })}
    </g>
  )
}

function Scatter({ color }: { color: string }) {
  const points = [
    [12, 44],
    [18, 30],
    [22, 38],
    [28, 22],
    [34, 28],
    [40, 34],
    [46, 18],
    [52, 26],
    [50, 12],
  ]
  return (
    <g>
      <line x1="6" y1="56" x2="58" y2="56" stroke={color} strokeOpacity={0.4} strokeWidth={1} />
      <line x1="8" y1="6" x2="8" y2="58" stroke={color} strokeOpacity={0.4} strokeWidth={1} />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill={color} opacity={0.85} />
      ))}
    </g>
  )
}

function Bubble({ color }: { color: string }) {
  const bubbles = [
    [16, 44, 5],
    [26, 26, 8],
    [40, 38, 6],
    [48, 18, 7],
    [22, 16, 4],
  ]
  return (
    <g>
      {bubbles.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.55 + (i % 3) * 0.15} />
      ))}
    </g>
  )
}

function Radar({ color }: { color: string }) {
  const cx = 32, cy = 32, r = 20
  const sides = 6
  const outer: [number, number][] = []
  const inner: [number, number][] = []
  for (let i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI) / sides - Math.PI / 2
    outer.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    const ir = r * (0.45 + 0.5 * Math.abs(Math.sin(i * 1.7)))
    inner.push([cx + ir * Math.cos(a), cy + ir * Math.sin(a)])
  }
  return (
    <g>
      <polygon
        points={outer.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      <polygon
        points={inner.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill={color}
        opacity={0.5}
        stroke={color}
        strokeWidth={1.5}
      />
    </g>
  )
}

function Treemap({ color }: { color: string }) {
  return (
    <g stroke="white" strokeWidth={1}>
      <rect x="6" y="8" width="32" height="28" fill={color} opacity={0.85} />
      <rect x="38" y="8" width="20" height="16" fill={color} opacity={0.6} />
      <rect x="38" y="24" width="20" height="12" fill={color} opacity={0.7} />
      <rect x="6" y="36" width="18" height="20" fill={color} opacity={0.55} />
      <rect x="24" y="36" width="14" height="20" fill={color} opacity={0.4} />
      <rect x="38" y="36" width="20" height="20" fill={color} opacity={0.5} />
    </g>
  )
}

function Sunburst({ color }: { color: string }) {
  return (
    <g transform="translate(32 32)">
      <circle r="6" fill={color} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a1 = (i * 60 - 90) * (Math.PI / 180)
        const a2 = ((i + 1) * 60 - 90) * (Math.PI / 180)
        const r1 = 8, r2 = 14
        return (
          <path
            key={`r1-${i}`}
            d={`M ${(r1 * Math.cos(a1)).toFixed(2)} ${(r1 * Math.sin(a1)).toFixed(2)} L ${(r2 * Math.cos(a1)).toFixed(2)} ${(r2 * Math.sin(a1)).toFixed(2)} A ${r2} ${r2} 0 0 1 ${(r2 * Math.cos(a2)).toFixed(2)} ${(r2 * Math.sin(a2)).toFixed(2)} L ${(r1 * Math.cos(a2)).toFixed(2)} ${(r1 * Math.sin(a2)).toFixed(2)} A ${r1} ${r1} 0 0 0 ${(r1 * Math.cos(a1)).toFixed(2)} ${(r1 * Math.sin(a1)).toFixed(2)} Z`}
            fill={color}
            opacity={0.55 + (i % 3) * 0.12}
            stroke="white"
            strokeWidth={0.5}
          />
        )
      })}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a1 = (i * 45 - 90) * (Math.PI / 180)
        const a2 = ((i + 1) * 45 - 90) * (Math.PI / 180)
        const r1 = 14, r2 = 22
        return (
          <path
            key={`r2-${i}`}
            d={`M ${(r1 * Math.cos(a1)).toFixed(2)} ${(r1 * Math.sin(a1)).toFixed(2)} L ${(r2 * Math.cos(a1)).toFixed(2)} ${(r2 * Math.sin(a1)).toFixed(2)} A ${r2} ${r2} 0 0 1 ${(r2 * Math.cos(a2)).toFixed(2)} ${(r2 * Math.sin(a2)).toFixed(2)} L ${(r1 * Math.cos(a2)).toFixed(2)} ${(r1 * Math.sin(a2)).toFixed(2)} A ${r1} ${r1} 0 0 0 ${(r1 * Math.cos(a1)).toFixed(2)} ${(r1 * Math.sin(a1)).toFixed(2)} Z`}
            fill={color}
            opacity={0.3 + (i % 4) * 0.1}
            stroke="white"
            strokeWidth={0.5}
          />
        )
      })}
    </g>
  )
}

function Choropleth({ color }: { color: string }) {
  // Simplified USA-shape silhouette as a rounded rectangle blob with regions
  return (
    <g>
      <path
        d="M 6 22 Q 6 16 12 14 L 28 12 L 38 10 L 50 14 Q 58 16 58 24 L 56 38 Q 54 46 46 48 L 30 50 L 18 48 Q 8 46 6 38 Z"
        fill={fillSoft(color, 0.2)}
        stroke={color}
        strokeWidth={1}
      />
      <path d="M 14 22 L 26 22 L 26 32 L 14 32 Z" fill={color} opacity={0.8} />
      <path d="M 26 22 L 38 22 L 38 32 L 26 32 Z" fill={color} opacity={0.5} />
      <path d="M 38 22 L 50 22 L 50 32 L 38 32 Z" fill={color} opacity={0.65} />
      <path d="M 14 32 L 28 32 L 28 44 L 14 44 Z" fill={color} opacity={0.4} />
      <path d="M 28 32 L 42 32 L 42 44 L 28 44 Z" fill={color} opacity={0.7} />
      <path d="M 42 32 L 54 32 L 54 42 L 42 42 Z" fill={color} opacity={0.55} />
    </g>
  )
}

function Sankey({ color }: { color: string }) {
  return (
    <g>
      {/* Left nodes */}
      <rect x="6" y="14" width="4" height="14" fill={color} opacity={0.85} />
      <rect x="6" y="34" width="4" height="18" fill={color} opacity={0.6} />
      {/* Right nodes */}
      <rect x="54" y="10" width="4" height="10" fill={color} opacity={0.8} />
      <rect x="54" y="24" width="4" height="14" fill={color} opacity={0.65} />
      <rect x="54" y="42" width="4" height="12" fill={color} opacity={0.5} />
      {/* Flows */}
      <path
        d="M 10 14 C 32 14, 32 10, 54 10 L 54 20 C 32 20, 32 28, 10 28 Z"
        fill={color}
        opacity={0.25}
      />
      <path
        d="M 10 28 C 32 28, 32 24, 54 24 L 54 38 C 32 38, 32 52, 10 52 Z"
        fill={color}
        opacity={0.2}
      />
      <path
        d="M 10 28 C 32 28, 32 42, 54 42 L 54 54 C 32 54, 32 28, 10 28 Z"
        fill={color}
        opacity={0.15}
      />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Diagram primitives
// ---------------------------------------------------------------------------

function Cycle({ n, color }: { n: number; color: string }) {
  const cx = 32, cy = 32, r = 20
  const positions = Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
  })
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity={0.35} strokeDasharray="2 3" />
      {/* arrow on the ring */}
      <path
        d={`M ${(cx + r * Math.cos(-Math.PI / 4)).toFixed(2)} ${(cy + r * Math.sin(-Math.PI / 4)).toFixed(2)} l -3 -3 m 3 3 l -1 4`}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      {positions.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={5} fill={color} opacity={0.85 - i * 0.05} />
      ))}
    </g>
  )
}

function Pyramid({ n, color }: { n: number; color: string }) {
  const baseW = 44
  const tipY = 12
  const baseY = 54
  const cx = 32
  const tiers: ReactElement[] = []
  for (let i = 0; i < n; i++) {
    const yTop = tipY + ((baseY - tipY) * i) / n
    const yBot = tipY + ((baseY - tipY) * (i + 1)) / n
    const wTop = (baseW * i) / n
    const wBot = (baseW * (i + 1)) / n
    const points = [
      [cx - wTop / 2, yTop],
      [cx + wTop / 2, yTop],
      [cx + wBot / 2, yBot - 0.5],
      [cx - wBot / 2, yBot - 0.5],
    ]
    tiers.push(
      <polygon
        key={i}
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill={color}
        opacity={0.95 - i * (0.6 / n)}
      />,
    )
  }
  return <g>{tiers}</g>
}

function Venn({ n, color }: { n: number; color: string }) {
  if (n === 2) {
    return (
      <g>
        <circle cx="24" cy="32" r="16" fill={color} opacity={0.5} />
        <circle cx="40" cy="32" r="16" fill={color} opacity={0.5} />
      </g>
    )
  }
  return (
    <g>
      <circle cx="24" cy="26" r="14" fill={color} opacity={0.45} />
      <circle cx="40" cy="26" r="14" fill={color} opacity={0.45} />
      <circle cx="32" cy="40" r="14" fill={color} opacity={0.45} />
    </g>
  )
}

function Honeycomb({ n, color }: { n: number; color: string }) {
  // Hex points for a unit hex (radius=8, pointy-top)
  function hex(cx: number, cy: number, r: number, fade: number) {
    const pts: string[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 - 30) * (Math.PI / 180)
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
    }
    return <polygon key={`${cx}-${cy}`} points={pts.join(" ")} fill={color} opacity={fade} />
  }
  // Layout up to 7 hexes: center + ring of 6
  const positions: { x: number; y: number; o: number }[] = [{ x: 32, y: 32, o: 0.95 }]
  const ring: { x: number; y: number }[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * (Math.PI / 180)
    ring.push({ x: 32 + 14 * Math.cos(a), y: 32 + 14 * Math.sin(a) })
  }
  ring.slice(0, n - 1).forEach((p, i) => positions.push({ ...p, o: 0.5 + (i % 3) * 0.15 }))
  return <g>{positions.map((p) => hex(p.x, p.y, 7, p.o))}</g>
}

function HubSpoke({ n, color }: { n: number; color: string }) {
  const cx = 32, cy = 32, r = 20
  const lines = []
  const dots = []
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    lines.push(<line key={`l-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeOpacity={0.4} strokeWidth={1} />)
    dots.push(<circle key={`d-${i}`} cx={x} cy={y} r={4} fill={color} opacity={0.8} />)
  }
  return (
    <g>
      {lines}
      <circle cx={cx} cy={cy} r={6} fill={color} />
      {dots}
    </g>
  )
}

function Funnel({ n, color }: { n: number; color: string }) {
  const stages: ReactElement[] = []
  const topY = 12
  const botY = 54
  const topW = 48
  const tipW = 8
  const cx = 32
  for (let i = 0; i < n; i++) {
    const yT = topY + ((botY - topY) * i) / n
    const yB = topY + ((botY - topY) * (i + 1)) / n
    const wT = topW - ((topW - tipW) * i) / n
    const wB = topW - ((topW - tipW) * (i + 1)) / n
    stages.push(
      <polygon
        key={i}
        points={`${cx - wT / 2},${yT} ${cx + wT / 2},${yT} ${cx + wB / 2},${yB - 0.5} ${cx - wB / 2},${yB - 0.5}`}
        fill={color}
        opacity={0.9 - i * (0.5 / n)}
      />,
    )
  }
  return <g>{stages}</g>
}

function Matrix({ dim, color }: { dim: number; color: string }) {
  const cells: ReactElement[] = []
  const total = 48
  const gap = 2
  const size = (total - (dim - 1) * gap) / dim
  const start = 8
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const isHi = (r + c) % 2 === 0
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={start + c * (size + gap)}
          y={start + r * (size + gap)}
          width={size}
          height={size}
          rx={1.5}
          fill={color}
          opacity={isHi ? 0.85 : 0.4}
        />,
      )
    }
  }
  return <g>{cells}</g>
}

function Swot({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="8" width="22" height="22" fill={color} opacity={0.85} rx={1} />
      <rect x="34" y="8" width="22" height="22" fill={color} opacity={0.55} rx={1} />
      <rect x="8" y="34" width="22" height="22" fill={color} opacity={0.55} rx={1} />
      <rect x="34" y="34" width="22" height="22" fill={color} opacity={0.85} rx={1} />
    </g>
  )
}

function Quadrant({ color }: { color: string }) {
  return (
    <g>
      <line x1="32" y1="6" x2="32" y2="58" stroke={color} strokeOpacity={0.5} />
      <line x1="6" y1="32" x2="58" y2="32" stroke={color} strokeOpacity={0.5} />
      <circle cx="20" cy="20" r="3" fill={color} opacity={0.75} />
      <circle cx="44" cy="22" r="4" fill={color} opacity={0.85} />
      <circle cx="22" cy="46" r="3.5" fill={color} opacity={0.7} />
      <circle cx="48" cy="44" r="2.5" fill={color} opacity={0.6} />
    </g>
  )
}

function ProcessFlow({ n, color }: { n: number; color: string }) {
  const elements: ReactElement[] = []
  const w = 8, gap = 4
  const totalW = n * w + (n - 1) * gap + (n - 1) * 4 // +arrows
  const startX = (64 - totalW) / 2
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap + 4)
    elements.push(<rect key={`r-${i}`} x={x} y={28} width={w} height={8} rx={1.5} fill={color} opacity={0.85} />)
    if (i < n - 1) {
      const ax = x + w + 1
      elements.push(
        <path
          key={`a-${i}`}
          d={`M ${ax} 32 L ${ax + 4} 32 M ${ax + 2} 30 L ${ax + 4} 32 L ${ax + 2} 34`}
          stroke={color}
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />,
      )
    }
  }
  return <g>{elements}</g>
}

function Flowchart({ color }: { color: string }) {
  return (
    <g>
      <rect x="22" y="8" width="20" height="10" rx={1.5} fill={color} opacity={0.9} />
      <line x1="32" y1="18" x2="32" y2="24" stroke={color} strokeOpacity={0.5} />
      <polygon points="32,24 44,32 32,40 20,32" fill={color} opacity={0.7} />
      <line x1="20" y1="32" x2="14" y2="32" stroke={color} strokeOpacity={0.5} />
      <line x1="44" y1="32" x2="50" y2="32" stroke={color} strokeOpacity={0.5} />
      <rect x="6" y="44" width="18" height="10" rx={1.5} fill={color} opacity={0.6} />
      <rect x="40" y="44" width="18" height="10" rx={1.5} fill={color} opacity={0.6} />
      <line x1="14" y1="32" x2="14" y2="44" stroke={color} strokeOpacity={0.5} />
      <line x1="50" y1="32" x2="50" y2="44" stroke={color} strokeOpacity={0.5} />
    </g>
  )
}

function TimelineHorizontal({ color }: { color: string }) {
  return (
    <g>
      <line x1="6" y1="32" x2="58" y2="32" stroke={color} strokeOpacity={0.4} strokeWidth={1.5} />
      {[12, 24, 36, 48].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={32} r={3.5} fill={color} opacity={0.9 - i * 0.1} />
          <line x1={x} y1={20} x2={x} y2={28} stroke={color} strokeOpacity={0.4} />
          <rect x={x - 5} y={12} width={10} height={6} rx={1} fill={color} opacity={0.6} />
        </g>
      ))}
    </g>
  )
}

function Gantt({ color }: { color: string }) {
  const bars = [
    { y: 14, x: 8, w: 22 },
    { y: 24, x: 16, w: 28 },
    { y: 34, x: 24, w: 24 },
    { y: 44, x: 32, w: 20 },
  ]
  return (
    <g>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={5} rx={1} fill={color} opacity={0.85 - i * 0.1} />
      ))}
      <line x1="6" y1="10" x2="6" y2="56" stroke={color} strokeOpacity={0.3} />
      <line x1="6" y1="56" x2="58" y2="56" stroke={color} strokeOpacity={0.3} />
    </g>
  )
}

function Sequence({ color }: { color: string }) {
  return (
    <g>
      <line x1="14" y1="10" x2="14" y2="54" stroke={color} strokeOpacity={0.4} strokeDasharray="2 3" />
      <line x1="32" y1="10" x2="32" y2="54" stroke={color} strokeOpacity={0.4} strokeDasharray="2 3" />
      <line x1="50" y1="10" x2="50" y2="54" stroke={color} strokeOpacity={0.4} strokeDasharray="2 3" />
      <rect x="9" y="6" width="10" height="6" fill={color} opacity={0.85} rx={1} />
      <rect x="27" y="6" width="10" height="6" fill={color} opacity={0.85} rx={1} />
      <rect x="45" y="6" width="10" height="6" fill={color} opacity={0.85} rx={1} />
      <line x1="14" y1="22" x2="32" y2="22" stroke={color} strokeWidth={1.2} />
      <polygon points="30,20 32,22 30,24" fill={color} />
      <line x1="32" y1="34" x2="50" y2="34" stroke={color} strokeWidth={1.2} />
      <polygon points="48,32 50,34 48,36" fill={color} />
      <line x1="50" y1="46" x2="14" y2="46" stroke={color} strokeWidth={1.2} />
      <polygon points="16,44 14,46 16,48" fill={color} />
    </g>
  )
}

function Network({ color }: { color: string }) {
  const nodes = [
    [16, 18],
    [42, 14],
    [50, 32],
    [38, 48],
    [16, 44],
    [30, 28],
  ]
  const edges: [number, number][] = [
    [0, 5],
    [1, 5],
    [1, 2],
    [2, 5],
    [2, 3],
    [3, 5],
    [4, 5],
    [4, 0],
  ]
  return (
    <g>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={color} strokeOpacity={0.4} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 4.5 : 3} fill={color} opacity={i === 5 ? 0.95 : 0.75} />
      ))}
    </g>
  )
}

function StateDiagram({ color }: { color: string }) {
  return (
    <g>
      <circle cx="14" cy="32" r="6" fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx="32" cy="20" r="6" fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx="32" cy="44" r="6" fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx="50" cy="32" r="6" fill={color} opacity={0.85} />
      <line x1="20" y1="32" x2="26" y2="22" stroke={color} strokeOpacity={0.5} />
      <line x1="20" y1="32" x2="26" y2="42" stroke={color} strokeOpacity={0.5} />
      <line x1="38" y1="20" x2="44" y2="30" stroke={color} strokeOpacity={0.5} />
      <line x1="38" y1="44" x2="44" y2="34" stroke={color} strokeOpacity={0.5} />
    </g>
  )
}

function ERDiagram({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="10" width="20" height="18" rx={1.5} fill={color} opacity={0.85} />
      <rect x="36" y="10" width="20" height="18" rx={1.5} fill={color} opacity={0.55} />
      <rect x="22" y="36" width="20" height="18" rx={1.5} fill={color} opacity={0.7} />
      <line x1="28" y1="19" x2="36" y2="19" stroke={color} strokeWidth={1.2} />
      <line x1="18" y1="28" x2="28" y2="36" stroke={color} strokeWidth={1.2} />
      <line x1="46" y1="28" x2="38" y2="36" stroke={color} strokeWidth={1.2} />
    </g>
  )
}

function Journey({ color }: { color: string }) {
  return (
    <g>
      <path
        d="M 6 48 Q 18 20 32 28 T 58 16"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {[
        [6, 48, 0.75],
        [20, 28, 0.6],
        [34, 30, 0.85],
        [48, 22, 0.7],
        [58, 16, 0.95],
      ].map(([x, y, o], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={color} opacity={o as number} />
      ))}
    </g>
  )
}

function ClassDiagram({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="8" width="22" height="20" fill="none" stroke={color} strokeWidth={1.2} />
      <line x1="8" y1="14" x2="30" y2="14" stroke={color} strokeWidth={1.2} />
      <rect x="34" y="34" width="22" height="20" fill="none" stroke={color} strokeWidth={1.2} />
      <line x1="34" y1="40" x2="56" y2="40" stroke={color} strokeWidth={1.2} />
      <line x1="30" y1="22" x2="44" y2="34" stroke={color} strokeOpacity={0.5} />
    </g>
  )
}

function GitGraph({ color }: { color: string }) {
  return (
    <g>
      <line x1="16" y1="10" x2="16" y2="54" stroke={color} strokeOpacity={0.4} strokeWidth={1.5} />
      <line x1="40" y1="22" x2="40" y2="48" stroke={color} strokeOpacity={0.4} strokeWidth={1.5} />
      <path d="M 16 22 Q 28 22 40 30" fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={1.5} />
      <path d="M 40 42 Q 28 42 16 50" fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={1.5} />
      {[
        [16, 14],
        [16, 22],
        [16, 50],
        [40, 30],
        [40, 42],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={color} />
      ))}
    </g>
  )
}

function Mindmap({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="32" cy="32" rx="9" ry="6" fill={color} opacity={0.9} />
      {[
        [12, 16],
        [52, 14],
        [10, 48],
        [54, 50],
        [32, 8],
        [32, 56],
      ].map(([x, y], i) => (
        <g key={i}>
          <line x1="32" y1="32" x2={x} y2={y} stroke={color} strokeOpacity={0.4} />
          <circle cx={x} cy={y} r={3.5} fill={color} opacity={0.7} />
        </g>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Infographic-only patterns
// ---------------------------------------------------------------------------

function Hierarchy({ color }: { color: string }) {
  return (
    <g>
      <rect x="26" y="6" width="12" height="8" rx={1} fill={color} opacity={0.95} />
      <line x1="32" y1="14" x2="32" y2="20" stroke={color} strokeOpacity={0.4} />
      <line x1="14" y1="20" x2="50" y2="20" stroke={color} strokeOpacity={0.4} />
      <line x1="14" y1="20" x2="14" y2="26" stroke={color} strokeOpacity={0.4} />
      <line x1="32" y1="20" x2="32" y2="26" stroke={color} strokeOpacity={0.4} />
      <line x1="50" y1="20" x2="50" y2="26" stroke={color} strokeOpacity={0.4} />
      <rect x="8" y="26" width="12" height="8" rx={1} fill={color} opacity={0.7} />
      <rect x="26" y="26" width="12" height="8" rx={1} fill={color} opacity={0.7} />
      <rect x="44" y="26" width="12" height="8" rx={1} fill={color} opacity={0.7} />
      <line x1="14" y1="34" x2="14" y2="44" stroke={color} strokeOpacity={0.3} />
      <line x1="32" y1="34" x2="32" y2="44" stroke={color} strokeOpacity={0.3} />
      <rect x="8" y="44" width="12" height="6" rx={1} fill={color} opacity={0.5} />
      <rect x="26" y="44" width="12" height="6" rx={1} fill={color} opacity={0.5} />
    </g>
  )
}

function Roadmap({ color }: { color: string }) {
  return (
    <g>
      <path
        d="M 6 48 L 22 48 L 26 36 L 38 36 L 42 24 L 58 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [6, 48],
        [24, 42],
        [40, 30],
        [58, 24],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.5} fill={color} opacity={0.85} />
      ))}
    </g>
  )
}

function Comparison({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="10" width="22" height="44" rx={2} fill={color} opacity={0.85} />
      <rect x="34" y="10" width="22" height="44" rx={2} fill={color} opacity={0.45} />
      <line x1="32" y1="6" x2="32" y2="58" stroke="white" strokeWidth={1.5} />
    </g>
  )
}

function Concentric({ color }: { color: string }) {
  return (
    <g transform="translate(32 32)">
      <circle r="22" fill="none" stroke={color} strokeWidth={1.5} opacity={0.35} />
      <circle r="16" fill="none" stroke={color} strokeWidth={1.5} opacity={0.55} />
      <circle r="10" fill="none" stroke={color} strokeWidth={1.5} opacity={0.75} />
      <circle r="4" fill={color} opacity={0.95} />
    </g>
  )
}

function Statistics({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="14" width="22" height="16" rx={1.5} fill={color} opacity={0.85} />
      <rect x="34" y="14" width="22" height="16" rx={1.5} fill={color} opacity={0.55} />
      <rect x="8" y="34" width="22" height="16" rx={1.5} fill={color} opacity={0.55} />
      <rect x="34" y="34" width="22" height="16" rx={1.5} fill={color} opacity={0.85} />
      {/* number tick marks */}
      <line x1="12" y1="20" x2="20" y2="20" stroke="white" strokeWidth={2} />
      <line x1="38" y1="20" x2="48" y2="20" stroke="white" strokeWidth={2} />
      <line x1="12" y1="40" x2="22" y2="40" stroke="white" strokeWidth={2} />
      <line x1="38" y1="40" x2="44" y2="40" stroke="white" strokeWidth={2} />
    </g>
  )
}

function ListVisual({ color }: { color: string }) {
  return (
    <g>
      {[12, 24, 36, 48].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y - 4} width={8} height={8} rx={2} fill={color} opacity={0.9 - i * 0.1} />
          <rect x="20" y={y - 2} width={36} height={4} rx={1} fill={color} opacity={0.45} />
        </g>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Element-type glyphs
// ---------------------------------------------------------------------------

function TextBox({ color }: { color: string }) {
  return (
    <g>
      <rect x="8" y="12" width="48" height="40" rx={2} fill="none" stroke={color} strokeOpacity={0.45} />
      {[18, 24, 30, 36].map((y, i) => (
        <rect
          key={i}
          x={12}
          y={y}
          width={i === 3 ? 28 : 40}
          height={2.5}
          rx={1}
          fill={color}
          opacity={0.85 - i * 0.15}
        />
      ))}
    </g>
  )
}

function Table({ color }: { color: string }) {
  return (
    <g>
      <rect x="6" y="12" width="52" height="40" rx={1.5} fill="none" stroke={color} strokeOpacity={0.5} />
      <rect x="6" y="12" width="52" height="8" fill={color} opacity={0.85} />
      <line x1="22" y1="12" x2="22" y2="52" stroke={color} strokeOpacity={0.3} />
      <line x1="40" y1="12" x2="40" y2="52" stroke={color} strokeOpacity={0.3} />
      <line x1="6" y1="28" x2="58" y2="28" stroke={color} strokeOpacity={0.3} />
      <line x1="6" y1="40" x2="58" y2="40" stroke={color} strokeOpacity={0.3} />
    </g>
  )
}

function ImageGlyph({ color }: { color: string }) {
  return (
    <g>
      <rect x="6" y="12" width="52" height="40" rx={2} fill={fillSoft(color, 0.2)} stroke={color} strokeOpacity={0.45} />
      <circle cx="20" cy="24" r="3" fill={color} opacity={0.85} />
      <path
        d="M 6 46 L 20 32 L 32 42 L 44 28 L 58 42 L 58 52 L 6 52 Z"
        fill={color}
        opacity={0.55}
      />
    </g>
  )
}

function IconLabel({ color }: { color: string }) {
  return (
    <g>
      <rect x="14" y="22" width="14" height="14" rx={2} fill={color} opacity={0.85} />
      <rect x="32" y="26" width="20" height="3" rx={1} fill={color} opacity={0.85} />
      <rect x="32" y="33" width="14" height="3" rx={1} fill={color} opacity={0.5} />
    </g>
  )
}

function Shape({ color }: { color: string }) {
  return (
    <g>
      <circle cx="20" cy="22" r="9" fill={color} opacity={0.85} />
      <rect x="34" y="14" width="18" height="18" fill={color} opacity={0.55} />
      <polygon points="32,52 14,52 23,38" fill={color} opacity={0.7} />
      <polygon points="42,52 50,38 58,52" fill={color} opacity={0.55} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// 8 real Text Labs diagram subtypes
// ---------------------------------------------------------------------------

function CodeDisplay({ color }: { color: string }) {
  return (
    <g>
      <rect x="6" y="10" width="52" height="44" rx={2} fill={fillSoft(color, 0.18)} stroke={color} strokeOpacity={0.4} />
      {/* Window chrome dots */}
      <circle cx="11" cy="15" r="1.5" fill={color} opacity={0.45} />
      <circle cx="16" cy="15" r="1.5" fill={color} opacity={0.45} />
      <circle cx="21" cy="15" r="1.5" fill={color} opacity={0.45} />
      <line x1="6" y1="20" x2="58" y2="20" stroke={color} strokeOpacity={0.2} />
      {/* Indented code lines */}
      <rect x="11" y="25" width="22" height="2" rx={1} fill={color} opacity={0.85} />
      <rect x="16" y="30" width="32" height="2" rx={1} fill={color} opacity={0.6} />
      <rect x="20" y="35" width="20" height="2" rx={1} fill={color} opacity={0.85} />
      <rect x="20" y="40" width="28" height="2" rx={1} fill={color} opacity={0.6} />
      <rect x="16" y="45" width="14" height="2" rx={1} fill={color} opacity={0.85} />
      <rect x="11" y="50" width="8" height="2" rx={1} fill={color} opacity={0.6} />
    </g>
  )
}

function CloudArchitecture({ color }: { color: string }) {
  return (
    <g>
      {/* Cloud silhouette */}
      <path
        d="M 18 24 Q 14 22 14 18 Q 14 12 22 12 Q 24 6 32 6 Q 42 6 44 14 Q 52 14 52 22 Q 52 28 44 28 L 22 28 Q 16 28 18 24 Z"
        fill={fillSoft(color, 0.2)}
        stroke={color}
        strokeOpacity={0.5}
      />
      {/* Service nodes inside */}
      <rect x="22" y="14" width="8" height="6" rx={1} fill={color} opacity={0.85} />
      <rect x="34" y="14" width="8" height="6" rx={1} fill={color} opacity={0.6} />
      {/* Below-cloud services connected by lines */}
      <line x1="20" y1="32" x2="20" y2="38" stroke={color} strokeOpacity={0.4} />
      <line x1="32" y1="32" x2="32" y2="38" stroke={color} strokeOpacity={0.4} />
      <line x1="44" y1="32" x2="44" y2="38" stroke={color} strokeOpacity={0.4} />
      <rect x="14" y="38" width="12" height="8" rx={1.5} fill={color} opacity={0.85} />
      <rect x="26" y="38" width="12" height="8" rx={1.5} fill={color} opacity={0.6} />
      <rect x="38" y="38" width="12" height="8" rx={1.5} fill={color} opacity={0.85} />
      {/* Bottom-most layer */}
      <rect x="8" y="50" width="48" height="6" rx={1.5} fill={color} opacity={0.4} />
    </g>
  )
}

function LogicalArchitecture({ color }: { color: string }) {
  // Three stacked layers — Presentation / Logic / Data — with arrows down.
  const opacities = [0.95, 0.7, 0.5]
  return (
    <g>
      {opacities.map((o, i) => (
        <g key={i}>
          <rect
            x="8"
            y={10 + i * 16}
            width="48"
            height="10"
            rx={1.5}
            fill={color}
            opacity={o}
          />
          {/* sub-cells inside the layer */}
          <line
            x1="24"
            y1={10 + i * 16}
            x2="24"
            y2={20 + i * 16}
            stroke="white"
            strokeOpacity={0.55}
          />
          <line
            x1="40"
            y1={10 + i * 16}
            x2="40"
            y2={20 + i * 16}
            stroke="white"
            strokeOpacity={0.55}
          />
        </g>
      ))}
      {/* Down arrows between layers */}
      <path d="M 32 22 L 32 26 M 30 24 L 32 26 L 34 24" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M 32 38 L 32 42 M 30 40 L 32 42 L 34 40" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </g>
  )
}

function DataArchitecture({ color }: { color: string }) {
  // Database cylinder feeding into processors and out to a target.
  const cylY = 14
  return (
    <g>
      {/* Source DB cylinder (left) */}
      <ellipse cx="14" cy={cylY} rx="6" ry="2.5" fill={color} opacity={0.85} />
      <rect x="8" y={cylY} width="12" height="14" fill={color} opacity={0.85} />
      <ellipse cx="14" cy={cylY + 14} rx="6" ry="2.5" fill={color} opacity={0.6} />
      <line x1="8" y1={cylY + 4} x2="20" y2={cylY + 4} stroke="white" strokeOpacity={0.4} />
      <line x1="8" y1={cylY + 9} x2="20" y2={cylY + 9} stroke="white" strokeOpacity={0.4} />
      {/* Processor nodes */}
      <rect x="28" y="18" width="14" height="8" rx={1.5} fill={color} opacity={0.85} />
      <rect x="28" y="32" width="14" height="8" rx={1.5} fill={color} opacity={0.6} />
      {/* Target DB (right) */}
      <ellipse cx="54" cy="32" rx="5" ry="2" fill={color} opacity={0.85} />
      <rect x="49" y="32" width="10" height="12" fill={color} opacity={0.85} />
      <ellipse cx="54" cy="44" rx="5" ry="2" fill={color} opacity={0.6} />
      {/* Flow arrows */}
      <path d="M 20 22 L 27 22 M 25 20 L 27 22 L 25 24" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M 20 36 L 27 36 M 25 34 L 27 36 L 25 38" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M 42 22 L 48 30 M 47 28 L 48 30 L 46 30" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M 42 36 L 48 36 M 46 34 L 48 36 L 46 38" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </g>
  )
}

function IdeaBoard({ color }: { color: string }) {
  // Sticky notes scattered at slight angles.
  const notes = [
    { x: 8, y: 10, r: -6, o: 0.85 },
    { x: 26, y: 8, r: 4, o: 0.7 },
    { x: 44, y: 12, r: -3, o: 0.85 },
    { x: 12, y: 30, r: 5, o: 0.6 },
    { x: 30, y: 32, r: -4, o: 0.85 },
    { x: 46, y: 30, r: 6, o: 0.7 },
    { x: 18, y: 48, r: -5, o: 0.6 },
    { x: 38, y: 48, r: 3, o: 0.85 },
  ]
  return (
    <g>
      {notes.map((n, i) => (
        <g key={i} transform={`rotate(${n.r} ${n.x + 6} ${n.y + 6})`}>
          <rect x={n.x} y={n.y} width="12" height="12" rx={1} fill={color} opacity={n.o} />
          <line x1={n.x + 2} y1={n.y + 4} x2={n.x + 10} y2={n.y + 4} stroke="white" strokeOpacity={0.5} />
          <line x1={n.x + 2} y1={n.y + 7} x2={n.x + 8} y2={n.y + 7} stroke="white" strokeOpacity={0.5} />
        </g>
      ))}
    </g>
  )
}

function KanbanBoard({ color }: { color: string }) {
  // 3 columns of stacked cards.
  return (
    <g>
      {[0, 1, 2].map((col) => {
        const x = 8 + col * 17
        const cardCounts = [3, 2, 1]
        const opacities = [0.85, 0.7, 0.55]
        return (
          <g key={col}>
            {/* Column header */}
            <rect x={x} y={8} width={14} height={4} rx={1} fill={color} opacity={opacities[col]} />
            {/* Cards */}
            {Array.from({ length: cardCounts[col] }).map((_, i) => (
              <rect
                key={i}
                x={x}
                y={16 + i * 12}
                width={14}
                height={9}
                rx={1.5}
                fill={color}
                opacity={0.4}
              />
            ))}
          </g>
        )
      })}
    </g>
  )
}

function ChevronMaturity({ color }: { color: string }) {
  // 5 chevron tiles pointing right, increasing saturation.
  const w = 11
  const h = 18
  const tip = 4
  const startX = 6
  const startY = (64 - h) / 2
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const x = startX + i * (w - tip)
        const o = 0.4 + i * 0.13
        return (
          <polygon
            key={i}
            points={`${x},${startY} ${x + w - tip},${startY} ${x + w},${startY + h / 2} ${x + w - tip},${startY + h} ${x},${startY + h} ${x + tip},${startY + h / 2}`}
            fill={color}
            opacity={o}
          />
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Imaginative infographic glyphs (the "anything you can describe" set)
// ---------------------------------------------------------------------------

function Ladder({ color }: { color: string }) {
  return (
    <g>
      <line x1="20" y1="6" x2="20" y2="58" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <line x1="44" y1="6" x2="44" y2="58" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {[14, 22, 30, 38, 46, 54].map((y) => (
        <line key={y} x1="20" y1={y} x2="44" y2={y} stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.85} />
      ))}
    </g>
  )
}

function Rocket({ color }: { color: string }) {
  return (
    <g>
      {/* Body */}
      <path
        d="M 32 4 Q 40 12 40 28 L 40 44 Q 40 50 32 52 Q 24 50 24 44 L 24 28 Q 24 12 32 4 Z"
        fill={color}
        opacity={0.85}
      />
      {/* Window */}
      <circle cx="32" cy="22" r="3.5" fill="white" opacity={0.85} />
      <circle cx="32" cy="22" r="2" fill={color} opacity={0.7} />
      {/* Section divider */}
      <line x1="24" y1="36" x2="40" y2="36" stroke="white" strokeOpacity={0.55} />
      {/* Fins */}
      <polygon points="24,40 18,52 24,52" fill={color} opacity={0.6} />
      <polygon points="40,40 46,52 40,52" fill={color} opacity={0.6} />
      {/* Flame */}
      <path
        d="M 28 52 Q 32 58 36 52 Q 34 60 32 62 Q 30 60 28 52 Z"
        fill={color}
        opacity={0.5}
      />
    </g>
  )
}

function Tree({ color }: { color: string }) {
  return (
    <g>
      {/* Trunk */}
      <rect x="29" y="40" width="6" height="18" fill={color} opacity={0.7} />
      {/* Crown — three overlapping circles */}
      <circle cx="32" cy="22" r="14" fill={color} opacity={0.55} />
      <circle cx="22" cy="30" r="10" fill={color} opacity={0.7} />
      <circle cx="42" cy="30" r="10" fill={color} opacity={0.7} />
      {/* "Leaves" as little dots — each a labeled item */}
      <circle cx="20" cy="22" r="2" fill={color} />
      <circle cx="32" cy="14" r="2" fill={color} />
      <circle cx="44" cy="22" r="2" fill={color} />
      <circle cx="26" cy="34" r="2" fill={color} />
      <circle cx="38" cy="34" r="2" fill={color} />
    </g>
  )
}

function Ship({ color }: { color: string }) {
  return (
    <g>
      {/* Hull */}
      <path
        d="M 6 38 L 58 38 L 52 50 Q 50 54 46 54 L 18 54 Q 14 54 12 50 Z"
        fill={color}
        opacity={0.85}
      />
      {/* Hull segment dividers */}
      <line x1="22" y1="38" x2="22" y2="54" stroke="white" strokeOpacity={0.5} />
      <line x1="42" y1="38" x2="42" y2="54" stroke="white" strokeOpacity={0.5} />
      {/* Mast */}
      <line x1="32" y1="6" x2="32" y2="38" stroke={color} strokeWidth={2} opacity={0.7} />
      {/* Sails */}
      <polygon points="32,8 32,30 18,30" fill={color} opacity={0.55} />
      <polygon points="32,12 32,30 46,30" fill={color} opacity={0.4} />
      {/* Waves */}
      <path d="M 4 58 Q 12 56 20 58 T 36 58 T 52 58 T 60 58" stroke={color} strokeOpacity={0.4} fill="none" />
    </g>
  )
}

function Rail({ color }: { color: string }) {
  return (
    <g>
      {/* Two parallel rails */}
      <line x1="6" y1="22" x2="58" y2="22" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
      <line x1="6" y1="42" x2="58" y2="42" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
      {/* Sleepers (ties) */}
      {[10, 18, 26, 34, 42, 50].map((x) => (
        <rect key={x} x={x} y="20" width="4" height="24" fill={color} opacity={0.4} />
      ))}
      {/* Two stations along the rail */}
      <circle cx="20" cy="32" r="3.5" fill={color} />
      <circle cx="44" cy="32" r="3.5" fill={color} />
    </g>
  )
}

function Anything({ color }: { color: string }) {
  return (
    <g>
      {/* Sparkle cluster signaling "infinite / generated" */}
      <g opacity={0.85}>
        <path
          d="M 32 14 L 34 26 L 46 28 L 34 30 L 32 42 L 30 30 L 18 28 L 30 26 Z"
          fill={color}
        />
        <path
          d="M 50 14 L 51 18 L 55 19 L 51 20 L 50 24 L 49 20 L 45 19 L 49 18 Z"
          fill={color}
          opacity={0.7}
        />
        <path
          d="M 16 44 L 17 48 L 21 49 L 17 50 L 16 54 L 15 50 L 11 49 L 15 48 Z"
          fill={color}
          opacity={0.7}
        />
        <path
          d="M 48 44 L 49 47 L 52 48 L 49 49 L 48 52 L 47 49 L 44 48 L 47 47 Z"
          fill={color}
          opacity={0.55}
        />
      </g>
      {/* Plus icon center-bottom */}
      <g transform="translate(32 50)">
        <circle r="6" fill={color} opacity={0.15} />
        <line x1="-3" y1="0" x2="3" y2="0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <line x1="0" y1="-3" x2="0" y2="3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endDeg)
  const end = polarToCartesian(cx, cy, r, startDeg)
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1"
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ")
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
