"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { Focus, Minus, Plus, RotateCcw } from "lucide-react"

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

const TYPE_COLORS: Record<string, string> = {
  ORG: "#60A5FA",
  PERSON: "#C084FC",
  CONCEPT: "#2DD4BF",
  METRIC: "#FBBF24",
  PRODUCT: "#FB7185",
  EVENT: "#FB923C",
  PLACE: "#4ADE80",
  TECHNOLOGY: "#818CF8",
  TREND: "#94A3B8",
}
const FALLBACK_COLORS = Object.values(TYPE_COLORS)

export function typeColor(entityType: string): string {
  if (TYPE_COLORS[entityType]) return TYPE_COLORS[entityType]
  let hash = 0
  for (let i = 0; i < entityType.length; i++) {
    hash = (hash * 31 + entityType.charCodeAt(i)) | 0
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

interface LayoutNode extends KgViewNode {
  x: number
  y: number
  r: number
}

interface ViewTransform {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.45
const MAX_SCALE = 3.5

function computeLayout(
  nodes: KgViewNode[],
  edges: KgViewEdge[],
  width: number,
  height: number
): LayoutNode[] {
  const count = nodes.length
  if (count === 0) return []

  const centerX = width / 2
  const centerY = height / 2
  const spread = Math.min(width, height) * 0.38
  const entityTypes = Array.from(new Set(nodes.map((node) => node.entity_type))).sort()
  const clusterCenters = new Map(
    entityTypes.map((type, index) => {
      const angle = (2 * Math.PI * index) / Math.max(entityTypes.length, 1) - Math.PI / 2
      const clusterRadius = Math.min(width, height) * (entityTypes.length > 1 ? 0.25 : 0)
      return [
        type,
        {
          x: centerX + clusterRadius * Math.cos(angle),
          y: centerY + clusterRadius * Math.sin(angle),
        },
      ] as const
    })
  )

  const points: LayoutNode[] = nodes.map((node, index) => ({
    ...node,
    x: centerX + spread * Math.cos((2 * Math.PI * index) / count),
    y: centerY + spread * Math.sin((2 * Math.PI * index) / count),
    r: 7 + Math.min(Math.sqrt(Math.max(node.salience ?? 1, 1)) * 3.2, 15),
  }))
  const indexById = new Map(points.map((point, index) => [point.node_id, index]))

  const iterations = 260
  const repulsion = 2500
  const spring = 0.016
  const springLength = 94
  const centerPull = 0.009
  const clusterPull = entityTypes.length > 1 ? 0.012 : 0

  for (let iteration = 0; iteration < iterations; iteration++) {
    const forceX = new Array(count).fill(0)
    const forceY = new Array(count).fill(0)

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        let dx = points[i].x - points[j].x
        let dy = points[i].y - points[j].y
        let distanceSquared = dx * dx + dy * dy
        if (distanceSquared < 1) {
          dx = 0.5 + (i % 3) * 0.25
          dy = 0.5 + (j % 3) * 0.25
          distanceSquared = dx * dx + dy * dy
        }
        const distance = Math.sqrt(distanceSquared)
        const force = repulsion / distanceSquared
        forceX[i] += (dx / distance) * force
        forceY[i] += (dy / distance) * force
        forceX[j] -= (dx / distance) * force
        forceY[j] -= (dy / distance) * force
      }
    }

    for (const edge of edges) {
      const source = indexById.get(edge.src_node_id)
      const target = indexById.get(edge.dst_node_id)
      if (source === undefined || target === undefined) continue
      const dx = points[target].x - points[source].x
      const dy = points[target].y - points[source].y
      const distance = Math.sqrt(dx * dx + dy * dy) || 1
      const force = spring * (distance - springLength) * Math.min(edge.weight ?? 1, 4)
      forceX[source] += (dx / distance) * force
      forceY[source] += (dy / distance) * force
      forceX[target] -= (dx / distance) * force
      forceY[target] -= (dy / distance) * force
    }

    const cooling = 1 - iteration / iterations
    for (let i = 0; i < count; i++) {
      const cluster = clusterCenters.get(points[i].entity_type)
      forceX[i] += (centerX - points[i].x) * centerPull
      forceY[i] += (centerY - points[i].y) * centerPull
      if (cluster) {
        forceX[i] += (cluster.x - points[i].x) * clusterPull
        forceY[i] += (cluster.y - points[i].y) * clusterPull
      }
      const cap = 12 * cooling + 1
      points[i].x += Math.max(-cap, Math.min(cap, forceX[i]))
      points[i].y += Math.max(-cap, Math.min(cap, forceY[i]))
      points[i].x = Math.max(points[i].r + 14, Math.min(width - points[i].r - 14, points[i].x))
      points[i].y = Math.max(points[i].r + 28, Math.min(height - points[i].r - 14, points[i].y))
    }
  }

  return points
}

function friendlyRelation(relation: string): string {
  return relation.replace(/_/g, " ").toLowerCase()
}

export function KgGraphView({
  nodes,
  edges,
  selectedId,
  onSelect,
  width = 960,
  height = 610,
}: {
  nodes: KgViewNode[]
  edges: KgViewEdge[]
  selectedId?: string | null
  onSelect?: (nodeId: string) => void
  width?: number
  height?: number
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 })

  const layout = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height]
  )
  const byId = useMemo(() => new Map(layout.map((point) => [point.node_id, point])), [layout])

  const labeledIds = useMemo(() => {
    const sorted = [...layout].sort((a, b) => b.salience - a.salience)
    return new Set(sorted.slice(0, 18).map((point) => point.node_id))
  }, [layout])
  const mobileNodes = useMemo(
    () => [...nodes].sort((a, b) => b.salience - a.salience).slice(0, 100),
    [nodes]
  )

  const activeId = hoverId || selectedId
  const neighborIds = useMemo(() => {
    if (!activeId) return null
    const ids = new Set<string>([activeId])
    for (const edge of edges) {
      if (edge.src_node_id === activeId) ids.add(edge.dst_node_id)
      if (edge.dst_node_id === activeId) ids.add(edge.src_node_id)
    }
    return ids
  }, [activeId, edges])

  const fitGraph = useCallback(() => {
    if (layout.length === 0) {
      setView({ x: 0, y: 0, scale: 1 })
      return
    }
    const minX = Math.min(...layout.map((point) => point.x - point.r))
    const maxX = Math.max(...layout.map((point) => point.x + point.r))
    const minY = Math.min(...layout.map((point) => point.y - point.r - 24))
    const maxY = Math.max(...layout.map((point) => point.y + point.r))
    const graphWidth = Math.max(maxX - minX, 1)
    const graphHeight = Math.max(maxY - minY, 1)
    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min((width - 80) / graphWidth, (height - 80) / graphHeight))
    )
    setView({
      scale,
      x: width / 2 - ((minX + maxX) / 2) * scale,
      y: height / 2 - ((minY + maxY) / 2) * scale,
    })
  }, [height, layout, width])

  useEffect(() => {
    fitGraph()
  }, [fitGraph])

  const zoomAround = useCallback(
    (nextScale: number, anchorX = width / 2, anchorY = height / 2) => {
      setView((current) => {
        const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale))
        const contentX = (anchorX - current.x) / current.scale
        const contentY = (anchorY - current.y) / current.scale
        return {
          scale,
          x: anchorX - contentX * scale,
          y: anchorY - contentY * scale,
        }
      })
    },
    [height, width]
  )

  const handleWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const anchorX = ((event.clientX - rect.left) / rect.width) * width
      const anchorY = ((event.clientY - rect.top) / rect.height) * height
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      zoomAround(view.scale * factor, anchorX, anchorY)
    },
    [height, view.scale, width, zoomAround]
  )

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    if ((event.target as Element).closest("[data-kg-node]")) return
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const pan = panRef.current
      if (!pan || pan.pointerId !== event.pointerId) return
      const rect = event.currentTarget.getBoundingClientRect()
      const dx = ((event.clientX - pan.x) / rect.width) * width
      const dy = ((event.clientY - pan.y) / rect.height) * height
      panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
    },
    [height, width]
  )

  const endPan = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (nodes.length === 0) return null

  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-[#070b18] lg:min-h-[520px]">
      <div className="lg:hidden">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-sm font-medium text-white">Entities by relevance</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Select an entity to inspect its relationships and source evidence.
          </p>
        </div>
        <ul className="max-h-[430px] overflow-y-auto p-2" aria-label="Knowledge graph entities">
          {mobileNodes.map((node) => (
            <li key={node.node_id}>
              <button
                type="button"
                onClick={() => onSelect?.(node.node_id)}
                aria-pressed={selectedId === node.node_id}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  selectedId === node.node_id ? "bg-white/10" : "hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white/5"
                  style={{ backgroundColor: typeColor(node.entity_type) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">{node.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">
                    {node.entity_type.toLowerCase()} · seen {node.mention_count}×
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute right-3 top-3 z-10 hidden items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1 shadow-xl backdrop-blur lg:flex">
        <button
          type="button"
          onClick={() => zoomAround(view.scale * 1.2)}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomAround(view.scale / 1.2)}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={fitGraph}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Fit graph to view"
          title="Fit graph"
        >
          <Focus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Reset graph view"
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-lg border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur lg:block">
        Scroll to zoom · drag to explore
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="hidden h-full w-full cursor-grab select-none touch-none active:cursor-grabbing lg:block lg:min-h-[520px]"
        role="group"
        aria-label={`Knowledge graph with ${nodes.length} entities and ${edges.length} relations`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <defs>
          <radialGradient id="kg-canvas-glow" cx="50%" cy="44%" r="70%">
            <stop offset="0%" stopColor="#312e81" stopOpacity="0.34" />
            <stop offset="52%" stopColor="#111827" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <pattern id="kg-dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#94a3b8" opacity="0.13" />
          </pattern>
          <filter id="kg-node-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} fill="#070b18" />
        <rect width={width} height={height} fill="url(#kg-canvas-glow)" />
        <rect width={width} height={height} fill="url(#kg-dot-grid)" />

        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {edges.map((edge) => {
            const source = byId.get(edge.src_node_id)
            const target = byId.get(edge.dst_node_id)
            if (!source || !target) return null
            const isAdjacent = activeId
              ? edge.src_node_id === activeId || edge.dst_node_id === activeId
              : false
            const dimmed = neighborIds
              ? !(neighborIds.has(edge.src_node_id) && neighborIds.has(edge.dst_node_id))
              : false
            return (
              <line
                key={`${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isAdjacent ? "#A78BFA" : "#64748B"}
                strokeWidth={isAdjacent ? 2 : Math.min(0.6 + (edge.weight ?? 1) * 0.38, 2.2)}
                opacity={dimmed ? 0.06 : isAdjacent ? 0.88 : 0.3}
              />
            )
          })}

          {activeId && edges
            .filter((edge) => edge.src_node_id === activeId || edge.dst_node_id === activeId)
            .slice(0, 8)
            .map((edge) => {
              const source = byId.get(edge.src_node_id)
              const target = byId.get(edge.dst_node_id)
              if (!source || !target) return null
              const label = friendlyRelation(edge.relation)
              const x = (source.x + target.x) / 2
              const y = (source.y + target.y) / 2
              const labelWidth = Math.max(42, Math.min(label.length * 5.4 + 14, 126))
              return (
                <g key={`label-${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`}>
                  <rect
                    x={x - labelWidth / 2}
                    y={y - 9}
                    width={labelWidth}
                    height={18}
                    rx={9}
                    fill="#0F172A"
                    stroke="#475569"
                    strokeWidth={0.7}
                    opacity={0.96}
                  />
                  <text x={x} y={y + 3} textAnchor="middle" fill="#CBD5E1" fontSize={8.5}>
                    {label.length > 20 ? `${label.slice(0, 19)}…` : label}
                  </text>
                </g>
              )
            })}

          {layout.map((point) => {
            const dimmed = neighborIds ? !neighborIds.has(point.node_id) : false
            const isSelected = selectedId === point.node_id
            const isHovered = hoverId === point.node_id
            const showLabel = labeledIds.has(point.node_id) || isSelected || isHovered
            return (
              <g
                key={point.node_id}
                data-kg-node
                transform={`translate(${point.x},${point.y})`}
                className="cursor-pointer outline-none"
                opacity={dimmed ? 0.18 : 1}
                role="button"
                tabIndex={0}
                aria-label={`${point.name}, ${point.entity_type.toLowerCase()}, seen ${point.mention_count} times`}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect?.(point.node_id)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect?.(point.node_id)
                  }
                }}
                onMouseEnter={() => setHoverId(point.node_id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(point.node_id)}
                onBlur={() => setHoverId(null)}
              >
                {(isSelected || isHovered) && (
                  <circle
                    r={point.r + 11}
                    fill={typeColor(point.entity_type)}
                    opacity={isSelected ? 0.15 : 0.09}
                    filter="url(#kg-node-glow)"
                  />
                )}
                <circle
                  r={point.r}
                  fill={typeColor(point.entity_type)}
                  stroke={isSelected ? "#F8FAFC" : "#E2E8F0"}
                  strokeWidth={isSelected ? 3 : 1.2}
                  opacity={0.96}
                  filter={isSelected ? "url(#kg-node-glow)" : undefined}
                >
                  <title>{`${point.name} (${point.entity_type}) — seen ${point.mention_count}×`}</title>
                </circle>
                <circle r={Math.max(point.r - 4, 2)} fill="#FFFFFF" opacity={0.08} />
                {showLabel && (
                  <g className="pointer-events-none">
                    <rect
                      x={-Math.min(point.name.length * 3.1 + 8, 78)}
                      y={-point.r - 23}
                      width={Math.min(point.name.length * 6.2 + 16, 156)}
                      height={17}
                      rx={8.5}
                      fill="#020617"
                      opacity={0.86}
                    />
                    <text
                      y={-point.r - 12}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize={9.5}
                      fontWeight={500}
                    >
                      {point.name.length > 25 ? `${point.name.slice(0, 24)}…` : point.name}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
