"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { Focus, List, Minus, Network, Plus, RotateCcw, ScanSearch } from "lucide-react"

import './studio-graph-controls.css'

const STUDIO_GRAPH_CONTROLS = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

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

/** Presentation only: the page owns the in-memory access lifetime and opaque key. */
export interface KgGraphPresentationState {
  key: object
  width: number
  height: number
  view: ViewTransform
  showList: boolean
}

export interface KgGraphPresentation {
  key: object
  stateRef: MutableRefObject<KgGraphPresentationState | null>
}

interface LayoutInputs {
  nodes: KgViewNode[]
  edges: KgViewEdge[]
  width: number
  height: number
}

function validView(view: ViewTransform): boolean {
  return Number.isFinite(view.x) && Number.isFinite(view.y) &&
    Number.isFinite(view.scale) && view.scale >= MIN_SCALE && view.scale <= MAX_SCALE
}

function readPresentation(presentation: KgGraphPresentation | undefined, width: number, height: number): KgGraphPresentationState | null {
  const state = presentation?.stateRef.current
  if (!state || state.key !== presentation?.key || state.width !== width || state.height !== height ||
    !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
    !state.view || !validView(state.view) || typeof state.showList !== "boolean") return null
  return { key: state.key, width, height, view: { ...state.view }, showList: state.showList }
}

function matchesLayout(inputs: LayoutInputs | null, nodes: KgViewNode[], edges: KgViewEdge[], width: number, height: number): boolean {
  return Boolean(inputs && inputs.nodes === nodes && inputs.edges === edges && inputs.width === width && inputs.height === height)
}

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

function compactGraphLabel(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}
function graphLabelWidth(text: string, fontSize: number, minimum = 40): number {
  const glyphs = [...text].reduce((sum, char) => sum + (/[MW@#%&]/.test(char) ? 1.05 : /[mw]/.test(char) ? .96 : /[iIl.,:;!|' ]/.test(char) ? .34 : /[A-Z]/.test(char) ? .8 : char.charCodeAt(0) > 255 ? 1.05 : .68), 0)
  return Math.max(minimum, glyphs * fontSize + 20)
}

interface LabelBox { x: number; y: number; width: number; height: number }
interface EntityLabelPlacement extends LabelBox { point: LayoutNode; fontSize: number; offsetY: number }
function labelBoxesOverlap(a: LabelBox, b: LabelBox): boolean {
  const gap = 5
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
}

/** Place annotations in painted pixels without moving a node or changing an edge.
 * Priority labels stay visible; ordinary collisions yield to real node/list inspection. */
function placeStudioLabels(layout: LayoutNode[], edges: KgViewEdge[], labeledIds: Set<string>, selectedId: string | null | undefined, hoverId: string | null, activeId: string | null, paintedScale: number, viewport?: LabelBox) {
  const occupied: LabelBox[] = []
  const entities: EntityLabelPlacement[] = []
  const relations = new Set<string>()
  const circles = layout.map(point => ({ x: point.x * paintedScale, y: point.y * paintedScale, r: point.r * paintedScale + 3 }))
  const hitsCircle = (box: LabelBox) => circles.some(circle => {
    const x = Math.max(box.x, Math.min(circle.x, box.x + box.width)), y = Math.max(box.y, Math.min(circle.y, box.y + box.height))
    return Math.hypot(circle.x - x, circle.y - y) < circle.r
  })
  const priority = (point: LayoutNode) => point.node_id === hoverId ? 0 : point.node_id === selectedId ? 1 : 2
  const candidates = layout.filter(point => labeledIds.has(point.node_id) || priority(point) < 2).sort((a, b) => priority(a) - priority(b) || b.salience - a.salience)
  for (const point of candidates) {
    const important = priority(point) < 2, fontSize = important ? 15 : 13
    // Reserve the same displayed text as the rendered plate, including wide glyphs.
    const width = graphLabelWidth(compactGraphLabel(point.name, 25), fontSize), height = 24, radius = point.r * paintedScale
    const offsets = [-radius - 29, radius + 5]
    const makeBox = (offsetY: number): LabelBox => ({ x: point.x * paintedScale - width / 2, y: point.y * paintedScale + offsetY, width, height })
    const clear = (offset: number, avoidCircles: boolean) => { const box = makeBox(offset); return !occupied.some(other => labelBoxesOverlap(box, other)) && (!avoidCircles || !hitsCircle(box)) }
    const fitsView = (offset: number) => { const box = makeBox(offset); return !viewport || box.x >= viewport.x && box.y >= viewport.y && box.x + box.width <= viewport.x + viewport.width && box.y + box.height <= viewport.y + viewport.height }
    let offsetY = offsets.find(offset => clear(offset, true) && fitsView(offset))
    if (important && offsetY === undefined) offsetY = offsets.find(offset => clear(offset, false) && fitsView(offset))
    // A panned-offscreen selection still owns a label and the existing Focus control.
    if (important && offsetY === undefined) offsetY = offsets.find(offset => clear(offset, false))
    if (important && offsetY === undefined) {
      // At most two priority entities exist. A bounded extra row keeps both accessible
      // even when their nodes coincide; the small leader shows its own node anchor.
      offsetY = [1, 2, 3].map(row => offsets[0] - row * 32).find(offset => clear(offset, false))
    }
    if (offsetY === undefined) continue
    const box = makeBox(offsetY); occupied.push(box); entities.push({ ...box, point, fontSize, offsetY })
  }
  if (activeId) for (const edge of edges.filter(edge => edge.src_node_id === activeId || edge.dst_node_id === activeId).slice(0, 8)) {
    const source = layout.find(point => point.node_id === edge.src_node_id), target = layout.find(point => point.node_id === edge.dst_node_id)
    if (!source || !target) continue
    const label = friendlyRelation(edge.relation), width = graphLabelWidth(compactGraphLabel(label, 20), 11, 62)
    const box = { x: (source.x + target.x) / 2 * paintedScale - width / 2, y: (source.y + target.y) / 2 * paintedScale - 11, width, height: 22 }
    if (occupied.some(other => labelBoxesOverlap(box, other)) || hitsCircle(box)) continue
    occupied.push(box); relations.add(`${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`)
  }
  return { entities, relations }
}

export function KgGraphView({
  nodes,
  edges,
  selectedId,
  onSelect,
  width = 960,
  height = 610,
  presentation,
}: {
  nodes: KgViewNode[]
  edges: KgViewEdge[]
  selectedId?: string | null
  onSelect?: (nodeId: string) => void
  width?: number
  height?: number
  presentation?: KgGraphPresentation
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [initialPresentation] = useState(() => readPresentation(presentation, width, height))
  const [view, setView] = useState<ViewTransform>(() => initialPresentation?.view ?? { x: 0, y: 0, scale: 1 })
  const [showList, setShowList] = useState(() => initialPresentation?.showList ?? false)
  const restoredInputsRef = useRef<LayoutInputs | null>(initialPresentation ? { nodes, edges, width, height } : null)
  const [fittedInputs, setFittedInputs] = useState<LayoutInputs | null>(() => initialPresentation ? { nodes, edges, width, height } : null)
  const [canvasScale, setCanvasScale] = useState(1)

  // Keep the accepted graph/layout transform, but make Studio labels readable at
  // their painted CSS size even when the SVG is letterboxed or the map is zoomed.
  useLayoutEffect(() => {
    if (!STUDIO_GRAPH_CONTROLS || showList) return
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const matrix = svg.getScreenCTM()
      if (!matrix) return
      const scale = Math.hypot(matrix.a, matrix.b)
      if (Number.isFinite(scale) && scale > 0) setCanvasScale(scale)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [height, width, showList])
  const labelScale = STUDIO_GRAPH_CONTROLS ? 1 / (canvasScale * view.scale) : 1

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

  // Search can select a real entity outside this bounded or filtered map.
  // Its detail remains inspectable without dimming every visible map entity.
  const activeId = hoverId && byId.has(hoverId) ? hoverId : selectedId && byId.has(selectedId) ? selectedId : null
  const selectedPoint = selectedId ? byId.get(selectedId) : undefined
  const entityTypes = useMemo(() => Array.from(new Set(nodes.map(node => node.entity_type))).sort(), [nodes])
  const neighborIds = useMemo(() => {
    if (!activeId) return null
    const ids = new Set<string>([activeId])
    for (const edge of edges) {
      if (edge.src_node_id === activeId) ids.add(edge.dst_node_id)
      if (edge.dst_node_id === activeId) ids.add(edge.src_node_id)
    }
    return ids
  }, [activeId, edges])

  const studioLabels = useMemo(() => STUDIO_GRAPH_CONTROLS ? placeStudioLabels(layout, edges, labeledIds, selectedId, hoverId, activeId, canvasScale * view.scale, { x: -view.x * canvasScale, y: -view.y * canvasScale, width: width * canvasScale, height: height * canvasScale }) : null, [layout, edges, labeledIds, selectedId, hoverId, activeId, canvasScale, view.scale, view.x, view.y, width, height])

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
    // Keep a valid restored tuple through StrictMode's setup rehearsal. A real
    // layout change invalidates restoration and uses the accepted automatic fit.
    if (matchesLayout(restoredInputsRef.current, nodes, edges, width, height)) return
    restoredInputsRef.current = null
    fitGraph()
    setFittedInputs({ nodes, edges, width, height })
  }, [fitGraph, nodes, edges, width, height])

  useLayoutEffect(() => {
    // Publish only after the matching fit/restoration has committed. In
    // particular, never bind a previous view to new data before passive fit.
    // No cleanup writes: a retired parent holder stays retired on unmount.
    if (!presentation || !matchesLayout(fittedInputs, nodes, edges, width, height) || !validView(view)) return
    presentation.stateRef.current = { key: presentation.key, width, height, view: { ...view }, showList }
  }, [presentation?.key, presentation?.stateRef, fittedInputs, nodes, edges, width, height, view, showList])

  const focusSelected = () => {
    if (!selectedPoint) return
    const scale = Math.max(view.scale, 1.8)
    setView({ scale, x: width / 2 - selectedPoint.x * scale, y: height / 2 - selectedPoint.y * scale })
  }

  // The SVG is letterboxed when the panel aspect ratio differs from its
  // viewBox. Use its actual transform so wheel anchors and drag distance
  // follow the pointer at every panel size.
  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    return point.matrixTransform(matrix.inverse())
  }, [])

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
      const anchor = canvasPoint(event.clientX, event.clientY)
      if (!anchor) return
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      zoomAround(view.scale * factor, anchor.x, anchor.y)
    },
    [canvasPoint, view.scale, zoomAround]
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
      const previous = canvasPoint(pan.x, pan.y)
      const next = canvasPoint(event.clientX, event.clientY)
      if (!previous || !next) return
      const dx = next.x - previous.x
      const dy = next.y - previous.y
      panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
    },
    [canvasPoint]
  )

  const endPan = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (nodes.length === 0) return null

  return (
    <div data-studio-graph-view={STUDIO_GRAPH_CONTROLS ? 'true' : undefined} data-studio-graph-mode={showList ? 'list' : 'map'} className="relative h-full overflow-hidden rounded-2xl bg-[#070b18] lg:min-h-[520px]">
      <div data-studio-graph-controls={STUDIO_GRAPH_CONTROLS ? 'mobile' : undefined} className={STUDIO_GRAPH_CONTROLS && showList ? "skg-entity-view" : "lg:hidden"}>
        <div data-studio-graph-control={STUDIO_GRAPH_CONTROLS ? 'heading' : undefined} className="border-b border-white/10 px-4 py-3">
          <p className="text-sm font-medium text-white">Entities by relevance</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {nodes.length} loaded entities. Select one to inspect its relationships and source evidence.
          </p>
        </div>
        <ul data-studio-graph-control={STUDIO_GRAPH_CONTROLS ? 'list' : undefined} className="max-h-[430px] overflow-y-auto p-2" aria-label="Knowledge graph entities">
          {mobileNodes.map((node) => (
            <li key={node.node_id}>
              <button
                type="button"
                onClick={() => onSelect?.(node.node_id)}
                data-studio-graph-control={STUDIO_GRAPH_CONTROLS ? 'entity' : undefined}
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
                  <span data-studio-graph-control={STUDIO_GRAPH_CONTROLS ? 'name' : undefined} className="block truncate text-sm font-medium text-slate-100">{node.name}</span>
                  <span data-studio-graph-control={STUDIO_GRAPH_CONTROLS ? 'context' : undefined} className="mt-0.5 block truncate text-xs text-slate-400">
                    {node.entity_type.toLowerCase()} · seen {node.mention_count}×
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div data-studio-graph-toolbar={STUDIO_GRAPH_CONTROLS ? 'true' : undefined} role="group" aria-label="Knowledge map controls" className="absolute right-3 top-3 z-10 hidden items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1 shadow-xl backdrop-blur lg:flex">
        {STUDIO_GRAPH_CONTROLS && <button type="button" onClick={() => setShowList(current => !current)} aria-pressed={showList} aria-label={showList ? "Show knowledge map" : "Show entity list"} title={showList ? "Show map" : "Entity list"}>{showList ? <Network className="h-4 w-4" /> : <List className="h-4 w-4" />}<span>{showList ? "Map" : "Entity list"}</span></button>}
        <button
          type="button"
          onClick={() => zoomAround(view.scale * 1.2)}
          disabled={STUDIO_GRAPH_CONTROLS && showList}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomAround(view.scale / 1.2)}
          disabled={STUDIO_GRAPH_CONTROLS && showList}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        {STUDIO_GRAPH_CONTROLS && <output className="skg-zoom" aria-label="Map zoom">{Math.round(view.scale * 100)}%</output>}
        <button
          type="button"
          onClick={fitGraph}
          disabled={STUDIO_GRAPH_CONTROLS && showList}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Fit graph to view"
          title="Fit graph"
        >
          <Focus className="h-4 w-4" />
        </button>
        {STUDIO_GRAPH_CONTROLS && <button type="button" onClick={focusSelected} disabled={showList || !selectedPoint} aria-label="Focus selected entity" title={selectedPoint ? `Focus ${selectedPoint.name}` : "Select an entity on this map to focus it"}><ScanSearch className="h-4 w-4" /><span>Focus entity</span></button>}
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          disabled={STUDIO_GRAPH_CONTROLS && showList}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Reset graph view"
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div data-studio-graph-hint={STUDIO_GRAPH_CONTROLS ? 'true' : undefined} className="pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-lg border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur lg:block">
        Scroll to zoom · drag to explore
      </div>

      {STUDIO_GRAPH_CONTROLS && <div className="skg-legend" aria-label="Entity type legend">{entityTypes.map(type => <span key={type}><i style={{ backgroundColor: typeColor(type) }} />{type.replace(/_/g, " ").toLowerCase()}</span>)}<span className="skg-relation-key"><i />Recorded relation</span></div>}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className={STUDIO_GRAPH_CONTROLS && showList ? "hidden" : "hidden h-full w-full cursor-grab select-none touch-none active:cursor-grabbing lg:block lg:min-h-[520px]"}
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
        <rect width={width} height={height} fill={STUDIO_GRAPH_CONTROLS ? "#10182b" : "#070b18"} />
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
              if (STUDIO_GRAPH_CONTROLS && !studioLabels?.relations.has(`${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`)) return null
              const label = friendlyRelation(edge.relation)
              const x = (source.x + target.x) / 2
              const y = (source.y + target.y) / 2
              const labelWidth = STUDIO_GRAPH_CONTROLS ? graphLabelWidth(compactGraphLabel(label, 20), 11, 62) : Math.max(42, Math.min(label.length * 5.4 + 14, 126))
              return (
                <g key={`label-${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`} data-studio-graph-label={STUDIO_GRAPH_CONTROLS ? "relation" : undefined} transform={STUDIO_GRAPH_CONTROLS ? `translate(${x} ${y}) scale(${labelScale})` : undefined} className={STUDIO_GRAPH_CONTROLS ? "pointer-events-none" : undefined}>
                  {STUDIO_GRAPH_CONTROLS && <title>{label}</title>}
                  <rect
                    x={(STUDIO_GRAPH_CONTROLS ? 0 : x) - labelWidth / 2}
                    y={STUDIO_GRAPH_CONTROLS ? -11 : y - 9}
                    width={labelWidth}
                    height={STUDIO_GRAPH_CONTROLS ? 22 : 18}
                    rx={STUDIO_GRAPH_CONTROLS ? 8 : 9}
                    fill="#0F172A"
                    stroke="#475569"
                    strokeWidth={0.7}
                    opacity={0.96}
                  />
                  <text x={STUDIO_GRAPH_CONTROLS ? 0 : x} y={STUDIO_GRAPH_CONTROLS ? 4 : y + 3} textAnchor="middle" fill="#CBD5E1" fontSize={STUDIO_GRAPH_CONTROLS ? 11 : 8.5}>
                    {compactGraphLabel(label, 20)}
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
                aria-pressed={STUDIO_GRAPH_CONTROLS ? isSelected : undefined}
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
                {showLabel && !STUDIO_GRAPH_CONTROLS && (
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
          {studioLabels?.entities.map(({ point, width: plateWidth, height: plateHeight, fontSize, offsetY }) => {
            const dimmed = neighborIds ? !neighborIds.has(point.node_id) : false
            const radius = point.r * canvasScale * view.scale
            const extraRow = offsetY < -radius - 29
            return <g key={`entity-label-${point.node_id}`} data-studio-graph-label="entity" data-studio-graph-label-node={point.node_id} aria-hidden="true" className="pointer-events-none" opacity={dimmed ? .18 : 1} transform={`translate(${point.x} ${point.y}) scale(${labelScale})`}>
              {extraRow && <line data-studio-graph-label-leader="true" x1={0} y1={-radius} x2={0} y2={offsetY + plateHeight} stroke="#81949f" strokeWidth={.7} opacity={.6} />}
              <rect x={-plateWidth / 2} y={offsetY} width={plateWidth} height={plateHeight} rx={8} fill="#020617" opacity={.92} />
              <text x={0} y={offsetY + 17} textAnchor="middle" fill="#E2E8F0" fontSize={fontSize} fontWeight={500}>{compactGraphLabel(point.name, 25)}</text>
            </g>
          })}
        </g>
      </svg>
    </div>
  )
}
