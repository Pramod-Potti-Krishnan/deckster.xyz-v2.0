/**
 * KNOWLEDGE-MAP-LABELS (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS, exact "true", default off; Studio shell only). Card PASS2-J6-FINDINGS, finding L7
 * "labels (dark label boxes over nodes, truncation)"; KNOWLEDGE-2 run 0109439e, streams/ops/PASS2/J6/RUN.md section 2.
 *
 * The Second Brain map drew every entity name on a dark plate placed ABOVE its node, over the edges and over neighbouring nodes, and cut each name at
 * 25 characters ("Northwind Quarterly Revi..."). The accepted mock (design/studio-v4-mockup/components/knowledge-map.tsx, `km-node-label`) draws clean text
 * under the node with a thin halo instead of a plate.
 *
 * What this does (the placement is components/knowledge/kg-graph-view.tsx placeStudioLabels() with different metrics; the rules are the same):
 *  - no plate: the name is text with a halo, so it reads over an edge or a neighbour without hiding it;
 *  - under the node first, above it when there is no room (the plates went above first);
 *  - a long name wraps to two lines (three for the selected or hovered entity) instead of being cut at 25 characters; only a name longer than that
 *    is cut, with an ellipsis, and the full name stays in the node's own tooltip and accessible name;
 *  - labels still never overlap each other, ordinary labels still never sit on a node, the hovered and the selected entity always keep one (the same
 *    fallbacks: allow a node under it, allow it outside the view, then an extra row above with a leader line), and the relation labels of the active
 *    entity are placed after them exactly as before.
 * The 18 most salient entities (plus the hovered and selected) are still the ones labelled; nodes, edges, zoom and the layout are untouched.
 *
 * Pure, no imports: the test loads this file on its own. The flag is read in components/knowledge/kg-graph-view.tsx (exact "true", Studio controls only);
 * with it off nothing in this file runs.
 */
export interface LabelBox {
  x: number
  y: number
  width: number
  height: number
}

export interface LabelPoint {
  node_id: string
  name: string
  x: number
  y: number
  r: number
  salience: number
}

export interface LabelEdge {
  src_node_id: string
  dst_node_id: string
  relation: string
}

export interface CleanEntityLabel<P extends LabelPoint = LabelPoint> extends LabelBox {
  point: P
  fontSize: number
  /** Top of the text block, relative to the node's centre, in painted pixels. */
  offsetY: number
  lines: string[]
  lineHeight: number
  /** Placed on an extra row above the node (the node is covered), so a leader line is drawn. */
  extraRow: boolean
}

export const ORDINARY = { fontSize: 13, perLine: 24, maxLines: 2 } as const
export const IMPORTANT = { fontSize: 15, perLine: 30, maxLines: 3 } as const
const GAP = 5

/** Same glyph widths as kg-graph-view.tsx graphLabelWidth(), without the plate's padding (there is no plate). */
export function textWidth(text: string, fontSize: number): number {
  const glyphs = [...text].reduce((sum, char) => sum + (/[MW@#%&]/.test(char) ? 1.05 : /[mw]/.test(char) ? 0.96 : /[iIl.,:;!|' ]/.test(char) ? 0.34 : /[A-Z]/.test(char) ? 0.8 : char.charCodeAt(0) > 255 ? 1.05 : 0.68), 0)
  return Math.max(24, glyphs * fontSize + 4)
}

/**
 * A name as at most `maxLines` lines of at most `perLine` characters, broken between words. Nothing is cut unless the name does not fit: then the last
 * line ends in an ellipsis. A single word longer than a line is cut the same way.
 */
export function wrapLabel(name: unknown, perLine: number, maxLines: number): string[] {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (text === '') return ['Unnamed entity']
  const all: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    const piece = word.length > perLine ? `${word.slice(0, perLine - 1)}…` : word
    if (current === '') current = piece
    else if (current.length + 1 + piece.length <= perLine) current += ` ${piece}`
    else { all.push(current); current = piece }
  }
  if (current !== '') all.push(current)
  if (all.length <= maxLines) return all
  const kept = all.slice(0, maxLines)
  const last = kept[maxLines - 1]
  kept[maxLines - 1] = last.endsWith('…') ? last : `${last.slice(0, perLine - 1).trimEnd()}…`
  return kept
}

export const friendlyRelation = (relation: string): string => String(relation).replace(/_/g, ' ').toLowerCase()
const compact = (text: string, limit: number): string => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text)
/** The width of the plate the view draws behind a relation label (kg-graph-view.tsx graphLabelWidth(compactGraphLabel(label, 20), 11, 62)); the placement reserves exactly that. */
export function relationWidth(relation: string): number {
  return Math.max(62, textWidth(compact(friendlyRelation(relation), 20), 11) + 16)
}
const overlaps = (a: LabelBox, b: LabelBox): boolean => a.x < b.x + b.width + GAP && a.x + a.width + GAP > b.x && a.y < b.y + b.height + GAP && a.y + a.height + GAP > b.y

/**
 * Where each name and relation label goes, in painted pixels (`paintedScale` = canvas scale x zoom). Same inputs and result shape as placeStudioLabels().
 * Priority order: the hovered entity, the selected one, then the rest by salience.
 */
export function placeCleanLabels<P extends LabelPoint>(
  layout: P[],
  edges: LabelEdge[],
  labeledIds: ReadonlySet<string>,
  selectedId: string | null | undefined,
  hoverId: string | null,
  activeId: string | null,
  paintedScale: number,
  viewport?: LabelBox,
): { entities: CleanEntityLabel<P>[]; relations: Set<string> } {
  const occupied: LabelBox[] = []
  const entities: CleanEntityLabel<P>[] = []
  const relations = new Set<string>()
  const circles = layout.map(point => ({ x: point.x * paintedScale, y: point.y * paintedScale, r: point.r * paintedScale + 3 }))
  const hitsCircle = (box: LabelBox) => circles.some(circle => {
    const x = Math.max(box.x, Math.min(circle.x, box.x + box.width)), y = Math.max(box.y, Math.min(circle.y, box.y + box.height))
    return Math.hypot(circle.x - x, circle.y - y) < circle.r
  })
  const priority = (point: P) => (point.node_id === hoverId ? 0 : point.node_id === selectedId ? 1 : 2)
  const candidates = layout.filter(point => labeledIds.has(point.node_id) || priority(point) < 2).sort((a, b) => priority(a) - priority(b) || b.salience - a.salience)
  for (const point of candidates) {
    const important = priority(point) < 2
    const metrics = important ? IMPORTANT : ORDINARY
    const lines = wrapLabel(point.name, metrics.perLine, metrics.maxLines)
    const lineHeight = metrics.fontSize + 3
    const width = Math.max(...lines.map(line => textWidth(line, metrics.fontSize)))
    const height = lines.length * lineHeight + 2
    const radius = point.r * paintedScale
    const offsets = [radius + 4, -radius - 4 - height]
    const makeBox = (offsetY: number): LabelBox => ({ x: point.x * paintedScale - width / 2, y: point.y * paintedScale + offsetY, width, height })
    const clear = (offset: number, avoidCircles: boolean) => { const box = makeBox(offset); return !occupied.some(other => overlaps(box, other)) && (!avoidCircles || !hitsCircle(box)) }
    const fitsView = (offset: number) => { const box = makeBox(offset); return !viewport || (box.x >= viewport.x && box.y >= viewport.y && box.x + box.width <= viewport.x + viewport.width && box.y + box.height <= viewport.y + viewport.height) }
    let offsetY = offsets.find(offset => clear(offset, true) && fitsView(offset))
    if (important && offsetY === undefined) offsetY = offsets.find(offset => clear(offset, false) && fitsView(offset))
    // A panned-offscreen selection still owns a label and the Focus control.
    if (important && offsetY === undefined) offsetY = offsets.find(offset => clear(offset, false))
    let extraRow = false
    if (important && offsetY === undefined) {
      offsetY = [1, 2, 3].map(row => offsets[1] - row * (height + GAP + 1)).find(offset => clear(offset, false))
      extraRow = offsetY !== undefined
    }
    if (offsetY === undefined) continue
    const box = makeBox(offsetY)
    occupied.push(box)
    entities.push({ ...box, point, fontSize: metrics.fontSize, offsetY, lines, lineHeight, extraRow })
  }
  if (activeId) {
    for (const edge of edges.filter(edge => edge.src_node_id === activeId || edge.dst_node_id === activeId).slice(0, 8)) {
      const source = layout.find(point => point.node_id === edge.src_node_id), target = layout.find(point => point.node_id === edge.dst_node_id)
      if (!source || !target) continue
      const width = relationWidth(edge.relation)
      const box = { x: ((source.x + target.x) / 2) * paintedScale - width / 2, y: ((source.y + target.y) / 2) * paintedScale - 11, width, height: 22 }
      if (occupied.some(other => overlaps(box, other)) || hitsCircle(box)) continue
      occupied.push(box)
      relations.add(`${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`)
    }
  }
  return { entities, relations }
}
