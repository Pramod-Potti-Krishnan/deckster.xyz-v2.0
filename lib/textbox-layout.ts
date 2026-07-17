import { splitGridArea, type GridSplitLayout, type LogicalGridRect } from '@/lib/grid-splitter'

export type TextBoxLayoutChoice = 'auto' | GridSplitLayout

export const MIN_TEXT_BOX_WIDTH = 4
export const MIN_TEXT_BOX_HEIGHT = 3

export interface TextBoxGridDimensions {
  columns: number
  rows: number
}

export interface ResolvedTextBoxLayout {
  requested: TextBoxLayoutChoice
  layout: GridSplitLayout
  gridColumns: number
  gridRows: number
  boxes: LogicalGridRect[]
  viable: boolean
}

export function textBoxGridDimensions(count: number): TextBoxGridDimensions[] {
  const safeCount = Math.min(6, Math.max(1, Math.trunc(count)))
  const dimensions: TextBoxGridDimensions[] = []
  for (let columns = 2; columns <= Math.min(3, safeCount); columns += 1) {
    const rows = Math.ceil(safeCount / columns)
    if (rows < 2) continue
    dimensions.push({ columns, rows })
  }
  return dimensions
}

function resolveCandidate(
  area: LogicalGridRect,
  count: number,
  layout: GridSplitLayout,
  gridColumns = 2,
): ResolvedTextBoxLayout {
  const safeCount = Math.min(6, Math.max(1, Math.trunc(count)))
  const safeColumns = layout === 'grid'
    ? Math.min(safeCount, Math.max(2, Math.trunc(gridColumns)))
    : 1
  const boxes = splitGridArea(area, safeCount, layout, safeColumns)
  return {
    requested: layout,
    layout,
    gridColumns: safeColumns,
    gridRows: layout === 'grid' ? Math.ceil(safeCount / safeColumns) : 1,
    boxes,
    viable: boxes.every(box => (
      box.position_width >= MIN_TEXT_BOX_WIDTH
      && box.position_height >= MIN_TEXT_BOX_HEIGHT
    )),
  }
}

function candidateScore(candidate: ResolvedTextBoxLayout): number {
  return Math.min(...candidate.boxes.map(box => Math.min(
    box.position_width / MIN_TEXT_BOX_WIDTH,
    box.position_height / MIN_TEXT_BOX_HEIGHT,
  )))
}

export function isTextBoxLayoutViable(
  area: LogicalGridRect,
  count: number,
  layout: GridSplitLayout,
  gridColumns = 2,
): boolean {
  if (layout === 'grid' && !textBoxGridDimensions(count).some(item => item.columns === gridColumns)) {
    return false
  }
  return resolveCandidate(area, count, layout, gridColumns).viable
}

export function isTextBoxCountViable(area: LogicalGridRect, count: number): boolean {
  const safeCount = Math.min(6, Math.max(1, Math.trunc(count)))
  if (safeCount === 1) return resolveCandidate(area, 1, 'horizontal').viable
  if (resolveCandidate(area, safeCount, 'horizontal').viable) return true
  if (resolveCandidate(area, safeCount, 'vertical').viable) return true
  return textBoxGridDimensions(safeCount).some(({ columns }) => (
    resolveCandidate(area, safeCount, 'grid', columns).viable
  ))
}

export function resolveTextBoxLayout(
  area: LogicalGridRect,
  count: number,
  requested: TextBoxLayoutChoice,
  gridColumns = 2,
): ResolvedTextBoxLayout {
  const safeCount = Math.min(6, Math.max(1, Math.trunc(count)))
  if (safeCount === 1) {
    const single = resolveCandidate(area, 1, 'horizontal')
    return { ...single, requested }
  }

  if (requested !== 'auto') {
    return { ...resolveCandidate(area, safeCount, requested, gridColumns), requested }
  }

  const directional = area.position_width >= area.position_height
    ? [
        resolveCandidate(area, safeCount, 'horizontal'),
        resolveCandidate(area, safeCount, 'vertical'),
      ]
    : [
        resolveCandidate(area, safeCount, 'vertical'),
        resolveCandidate(area, safeCount, 'horizontal'),
      ]
  const gridCandidates = textBoxGridDimensions(safeCount).map(({ columns }) => (
    resolveCandidate(area, safeCount, 'grid', columns)
  ))
  const candidates = [...directional, ...gridCandidates]
  const viable = candidates.find(candidate => candidate.viable)
  if (viable) return { ...viable, requested }

  const best = candidates.sort((left, right) => candidateScore(right) - candidateScore(left))[0]
  return { ...best, requested }
}
