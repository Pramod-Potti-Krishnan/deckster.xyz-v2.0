"use client"

/**
 * KG v2 P3 — dependency-free force-directed graph view (D-KG5).
 *
 * Deterministic: nodes start on a circle (angle by index) and a fixed number
 * of force iterations run synchronously in a memo — same input, same layout,
 * no RAF loop, no d3. Scoped to the top ~100 nodes by the caller.
 */

import { useMemo, useState } from "react"

export interface KgViewNode {
  node_id: string
  name: string
  entity_type: string
  description?: string | null
  salience: number
  mention_count: number
}

export interface KgViewEdge {
  src_node_id: string
  dst_node_id: string
  relation: string
  weight: number
}

// Fixed palette keyed by entity type; unknown types hash into it.
const TYPE_COLORS: Record<string, string> = {
  ORG: "#2980B9",
  PERSON: "#8E44AD",
  CONCEPT: "#16A085",
  METRIC: "#E67E22",
  PRODUCT: "#C0392B",
  EVENT: "#D35400",
  PLACE: "#27AE60",
  TECHNOLOGY: "#34495E",
  TREND: "#7F8C8D",
}
const FALLBACK_COLORS = Object.values(TYPE_COLORS)

export function typeColor(entityType: string): string {
  if (TYPE_COLORS[entityType]) return TYPE_COLORS[entityType]
  let h = 0
  for (let i = 0; i < entityType.length; i++) h = (h * 31 + entityType.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]
}

interface LayoutNode extends KgViewNode {
  x: number
  y: number
  r: number
}

function computeLayout(
  nodes: KgViewNode[],
  edges: KgViewEdge[],
  width: number,
  height: number
): LayoutNode[] {
  const n = nodes.length
  if (n === 0) return []
  const cx = width / 2
  const cy = height / 2
  const spread = Math.min(width, height) * 0.38

  const pts: LayoutNode[] = nodes.map((node, i) => ({
    ...node,
    x: cx + spread * Math.cos((2 * Math.PI * i) / n),
    y: cy + spread * Math.sin((2 * Math.PI * i) / n),
    r: 6 + Math.min(node.salience ?? 1, 18),
  }))
  const index = new Map(pts.map((p, i) => [p.node_id, i]))

  const ITERATIONS = 250
  const REPULSION = 2200
  const SPRING = 0.015
  const SPRING_LEN = 90
  const CENTER_PULL = 0.012

  for (let it = 0; it < ITERATIONS; it++) {
    const fx = new Array(n).fill(0)
    const fy = new Array(n).fill(0)

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pts[i].x - pts[j].x
        let dy = pts[i].y - pts[j].y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          // Deterministic nudge for coincident points.
          dx = 0.5 + (i % 3) * 0.25
          dy = 0.5 + (j % 3) * 0.25
          d2 = dx * dx + dy * dy
        }
        const f = REPULSION / d2
        const d = Math.sqrt(d2)
        fx[i] += (dx / d) * f
        fy[i] += (dy / d) * f
        fx[j] -= (dx / d) * f
        fy[j] -= (dy / d) * f
      }
    }

    for (const e of edges) {
      const a = index.get(e.src_node_id)
      const b = index.get(e.dst_node_id)
      if (a === undefined || b === undefined) continue
      const dx = pts[b].x - pts[a].x
      const dy = pts[b].y - pts[a].y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = SPRING * (d - SPRING_LEN) * Math.min(e.weight ?? 1, 4)
      fx[a] += (dx / d) * f
      fy[a] += (dy / d) * f
      fx[b] -= (dx / d) * f
      fy[b] -= (dy / d) * f
    }

    const cool = 1 - it / ITERATIONS
    for (let i = 0; i < n; i++) {
      fx[i] += (cx - pts[i].x) * CENTER_PULL
      fy[i] += (cy - pts[i].y) * CENTER_PULL
      const cap = 12 * cool + 1
      pts[i].x += Math.max(-cap, Math.min(cap, fx[i]))
      pts[i].y += Math.max(-cap, Math.min(cap, fy[i]))
      pts[i].x = Math.max(pts[i].r, Math.min(width - pts[i].r, pts[i].x))
      pts[i].y = Math.max(pts[i].r, Math.min(height - pts[i].r, pts[i].y))
    }
  }
  return pts
}

export function KgGraphView({
  nodes,
  edges,
  selectedId,
  onSelect,
  width = 860,
  height = 520,
}: {
  nodes: KgViewNode[]
  edges: KgViewEdge[]
  selectedId?: string | null
  onSelect?: (nodeId: string) => void
  width?: number
  height?: number
}) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  const layout = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height]
  )
  const byId = useMemo(
    () => new Map(layout.map((p) => [p.node_id, p])),
    [layout]
  )

  // Label the most salient nodes only, to keep the canvas readable.
  const labeledIds = useMemo(() => {
    const sorted = [...layout].sort((a, b) => b.salience - a.salience)
    return new Set(sorted.slice(0, 20).map((p) => p.node_id))
  }, [layout])

  const neighborIds = useMemo(() => {
    const active = hoverId || selectedId
    if (!active) return null
    const ids = new Set<string>([active])
    for (const e of edges) {
      if (e.src_node_id === active) ids.add(e.dst_node_id)
      if (e.dst_node_id === active) ids.add(e.src_node_id)
    }
    return ids
  }, [hoverId, selectedId, edges])

  if (nodes.length === 0) return null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      role="img"
      aria-label="Knowledge graph visualization"
    >
      {edges.map((e, i) => {
        const a = byId.get(e.src_node_id)
        const b = byId.get(e.dst_node_id)
        if (!a || !b) return null
        const dimmed = neighborIds
          ? !(neighborIds.has(e.src_node_id) && neighborIds.has(e.dst_node_id))
          : false
        return (
          <line
            key={`e${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="currentColor"
            className="text-gray-300 dark:text-slate-700"
            strokeWidth={Math.min(0.5 + (e.weight ?? 1) * 0.5, 3)}
            opacity={dimmed ? 0.15 : 0.7}
          />
        )
      })}
      {layout.map((p) => {
        const dimmed = neighborIds ? !neighborIds.has(p.node_id) : false
        const isSelected = selectedId === p.node_id
        return (
          <g
            key={p.node_id}
            transform={`translate(${p.x},${p.y})`}
            className="cursor-pointer"
            opacity={dimmed ? 0.3 : 1}
            onClick={() => onSelect?.(p.node_id)}
            onMouseEnter={() => setHoverId(p.node_id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <circle
              r={p.r}
              fill={typeColor(p.entity_type)}
              stroke={isSelected ? "#0F172A" : "white"}
              strokeWidth={isSelected ? 3 : 1.5}
              opacity={0.9}
            >
              <title>{`${p.name} (${p.entity_type}) — seen ${p.mention_count}×`}</title>
            </circle>
            {(labeledIds.has(p.node_id) || isSelected || hoverId === p.node_id) && (
              <text
                y={-p.r - 4}
                textAnchor="middle"
                className="fill-gray-700 text-[10px] font-medium dark:fill-slate-300"
              >
                {p.name.length > 24 ? `${p.name.slice(0, 23)}…` : p.name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
