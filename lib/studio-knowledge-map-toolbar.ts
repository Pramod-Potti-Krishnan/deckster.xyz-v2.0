/**
 * KNOWLEDGE-MAP-TOOLBAR (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR, exact "true", default off; Studio shell only). Card PASS2-J6-FINDINGS, finding L6
 * "map toolbar and legend (zoom 205% default)"; KNOWLEDGE-2 run 0109439e, streams/ops/PASS2/J6/RUN.md section 2.
 *
 * The Second Brain map opened at "205%" (190% on a smaller graph): the readout was the raw scale of the SVG transform, and the map is fitted to its panel
 * when it loads, so it never read 100% unless the person pressed "Reset graph view" (which did NOT go back to the fitted view, it went to raw scale 1).
 * The toolbar also had two buttons that did nearly the same thing (Fit graph, Reset graph view), icon-only, a "Focus entity" that sat disabled until
 * something was selected, and zoom buttons in the order +, -. The accepted mock (design/studio-v4-mockup/components/knowledge-map.tsx, `km-map-controls`)
 * has "- 100% +", a mode button, "Reset map".
 *
 * What this does:
 *  - the readout is relative to the fitted view: the view the map opens at (and "Reset map" returns to) reads 100%; zoom in reads 120%, 144% ...;
 *  - one "Reset map" button, which fits the graph to the panel again; "Fit graph" is not drawn;
 *  - "- 100% +" together, in that order; the entity list / map button as before; "Focus entity" only while an entity is selected.
 * The zoom limits, the wheel, the drag and the layout are unchanged; only what is read out and which controls are drawn.
 *
 * Not in this change: the mock's "Orbiting" and "Full screen" (a 3D constellation and an immersive mode are new features) and a different legend
 * (the legend already lists the entity types the map shows and its one kind of line, "Recorded relation").
 *
 * Pure, no imports: the test loads this file on its own. The flag is read in components/knowledge/kg-graph-view.tsx (exact "true", Studio controls only);
 * with it off nothing in this file runs.
 */
export const RESET_LABEL = 'Reset map'

// components/knowledge/kg-graph-view.tsx fitGraph(), which the test checks this against line by line.
export const MIN_SCALE = 0.45
export const MAX_SCALE = 3.5
const FIT_MARGIN = 80
const LABEL_ROOM = 24

interface Point {
  x: number
  y: number
  r: number
}

/** The scale fitGraph() gives this layout in this panel: 1 for no points. The same number the map opens at, so it is what "100%" means. */
export function knowledgeFitScale(points: readonly Point[], width: number, height: number): number {
  if (!Array.isArray(points) || points.length === 0) return 1
  const minX = Math.min(...points.map(point => point.x - point.r))
  const maxX = Math.max(...points.map(point => point.x + point.r))
  const minY = Math.min(...points.map(point => point.y - point.r - LABEL_ROOM))
  const maxY = Math.max(...points.map(point => point.y + point.r))
  const graphWidth = Math.max(maxX - minX, 1)
  const graphHeight = Math.max(maxY - minY, 1)
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min((width - FIT_MARGIN) / graphWidth, (height - FIT_MARGIN) / graphHeight)))
}

/** The number read out: the view's scale as a percentage of the fitted view's. A fit that is not a positive number reads the raw scale (what the map said before). */
export function zoomPercent(viewScale: number, fitScale: number): number {
  if (!(typeof viewScale === 'number' && Number.isFinite(viewScale) && viewScale > 0)) return 100
  const base = typeof fitScale === 'number' && Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1
  return Math.round((viewScale / base) * 100)
}

export interface ToolbarState {
  zoomDisabled: boolean
  resetDisabled: boolean
  /** "Focus entity" is drawn only while an entity is selected. */
  showFocus: boolean
  focusDisabled: boolean
  listLabel: string
  listAriaLabel: string
  listTitle: string
}

/** What the toolbar draws: the entity list shows no map, so the map's own controls are off there. */
export function toolbarState(input: { showList: boolean; hasSelection: boolean }): ToolbarState {
  const { showList, hasSelection } = input
  return {
    zoomDisabled: showList,
    resetDisabled: showList,
    showFocus: hasSelection,
    focusDisabled: showList,
    listLabel: showList ? 'Map' : 'Entity list',
    listAriaLabel: showList ? 'Show knowledge map' : 'Show entity list',
    listTitle: showList ? 'Show map' : 'Entity list',
  }
}

export function focusTitle(name: unknown): string {
  return typeof name === 'string' && name.trim() !== '' ? `Focus ${name}` : 'Focus the selected entity'
}
