const MINOR_GRID_SCALE = 5
const MINOR_GRID_INCREMENT = 1 / MINOR_GRID_SCALE
const GRID_EPSILON = 1e-8

export type GridSplitLayout = 'horizontal' | 'vertical' | 'grid'

export interface LogicalGridRect {
  start_col: number
  start_row: number
  position_width: number
  position_height: number
}

export interface GridAxisSegment {
  start: number
  size: number
}

function toMinorUnits(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`)
  }
  const units = Math.round(value * MINOR_GRID_SCALE)
  if (Math.abs(value * MINOR_GRID_SCALE - units) > GRID_EPSILON) {
    throw new Error(`${label} must use ${MINOR_GRID_INCREMENT} grid increments`)
  }
  return units
}

function fromMinorUnits(units: number): number {
  return Number((units / MINOR_GRID_SCALE).toFixed(1))
}

/**
 * Split one logical-grid span into balanced 0.2-grid segments. Remainder minor
 * cells are assigned from the leading edge, so 25 / 3 is 8.4, 8.4, 8.2.
 */
export function splitGridSpan(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Grid split count must be a positive integer')
  }

  const totalUnits = toMinorUnits(total, 'Grid span')
  if (totalUnits < count) {
    throw new Error(`Grid span must provide at least ${MINOR_GRID_INCREMENT} per segment`)
  }

  const baseUnits = Math.floor(totalUnits / count)
  const remainderUnits = totalUnits % count
  return Array.from(
    { length: count },
    (_, index) => fromMinorUnits(baseUnits + (index < remainderUnits ? 1 : 0)),
  )
}

export function splitGridAxis(start: number, total: number, count: number): GridAxisSegment[] {
  let currentUnits = toMinorUnits(start, 'Grid start')
  return splitGridSpan(total, count).map(size => {
    const sizeUnits = toMinorUnits(size, 'Grid segment')
    const segment = { start: fromMinorUnits(currentUnits), size }
    currentUnits += sizeUnits
    return segment
  })
}

/**
 * Produce contiguous rectangles for horizontal, vertical, and row-major grid
 * compositions without floating-point accumulation.
 */
export function splitGridArea(
  area: LogicalGridRect,
  count: number,
  layout: GridSplitLayout,
  requestedGridColumns = 1,
): LogicalGridRect[] {
  if (count <= 1) return [area]

  if (layout === 'horizontal') {
    return splitGridAxis(area.start_col, area.position_width, count).map(segment => ({
      start_col: segment.start,
      start_row: area.start_row,
      position_width: segment.size,
      position_height: area.position_height,
    }))
  }

  if (layout === 'vertical') {
    return splitGridAxis(area.start_row, area.position_height, count).map(segment => ({
      start_col: area.start_col,
      start_row: segment.start,
      position_width: area.position_width,
      position_height: segment.size,
    }))
  }

  const columns = Math.min(Math.max(1, Math.trunc(requestedGridColumns)), count)
  const rows = Math.ceil(count / columns)
  const columnSegments = splitGridAxis(area.start_col, area.position_width, columns)
  const rowSegments = splitGridAxis(area.start_row, area.position_height, rows)

  return Array.from({ length: count }, (_, index) => {
    const column = columnSegments[index % columns]
    const row = rowSegments[Math.floor(index / columns)]
    return {
      start_col: column.start,
      start_row: row.start,
      position_width: column.size,
      position_height: row.size,
    }
  })
}
