import { splitGridArea, type GridSplitLayout, type LogicalGridRect } from '@/lib/grid-splitter'

export type MetricsLayoutChoice = 'auto' | GridSplitLayout

export const MIN_METRIC_CARD_WIDTH = 2
export const MIN_METRIC_CARD_HEIGHT = 2

export interface ResolvedMetricsLayout {
  requested: MetricsLayoutChoice
  layout: GridSplitLayout
  gridColumns: number
  boxes: LogicalGridRect[]
  viable: boolean
}

function gridColumnsForCount(count: number): number {
  return count <= 1 ? 1 : 2
}

function resolveCandidate(area: LogicalGridRect, count: number, layout: GridSplitLayout): ResolvedMetricsLayout {
  const gridColumns = layout === 'grid' ? gridColumnsForCount(count) : 1
  const boxes = splitGridArea(area, count, layout, gridColumns)
  return {
    requested: layout,
    layout,
    gridColumns,
    boxes,
    viable: boxes.every(box => (
      box.position_width >= MIN_METRIC_CARD_WIDTH
      && box.position_height >= MIN_METRIC_CARD_HEIGHT
    )),
  }
}

function candidateScore(candidate: ResolvedMetricsLayout): number {
  return Math.min(...candidate.boxes.map(box => Math.min(
    box.position_width / MIN_METRIC_CARD_WIDTH,
    box.position_height / MIN_METRIC_CARD_HEIGHT,
  )))
}

/**
 * Resolve the user-facing Auto arrangement from the actual live logical-grid
 * rectangle. Geometry is split only here; Text Service remains the sole owner
 * of content fit, typography, and internal padding.
 */
export function resolveMetricsLayout(
  area: LogicalGridRect,
  count: number,
  requested: MetricsLayoutChoice,
): ResolvedMetricsLayout {
  const safeCount = Math.min(4, Math.max(1, Math.trunc(count)))
  if (safeCount === 1) {
    const single = resolveCandidate(area, 1, 'horizontal')
    return { ...single, requested }
  }

  if (requested !== 'auto') {
    return { ...resolveCandidate(area, safeCount, requested), requested }
  }

  const horizontal = resolveCandidate(area, safeCount, 'horizontal')
  const vertical = resolveCandidate(area, safeCount, 'vertical')

  if (safeCount === 4) {
    const grid = resolveCandidate(area, safeCount, 'grid')
    if (grid.viable) return { ...grid, requested }
  }

  const directional = area.position_width >= area.position_height
    ? [horizontal, vertical]
    : [vertical, horizontal]
  const viable = directional.find(candidate => candidate.viable)
  if (viable) return { ...viable, requested }

  // A very small placeholder may have no arrangement meeting the minimum.
  // Return the least-constrained deterministic split so the UI can ask the
  // user to resize it without inventing a content-fit formula.
  const best = [horizontal, vertical].sort((left, right) => candidateScore(right) - candidateScore(left))[0]
  return { ...best, requested }
}

export function isMetricsLayoutViable(
  area: LogicalGridRect,
  count: number,
  layout: Exclude<MetricsLayoutChoice, 'auto'>,
): boolean {
  return resolveCandidate(area, Math.min(4, Math.max(1, Math.trunc(count))), layout).viable
}
