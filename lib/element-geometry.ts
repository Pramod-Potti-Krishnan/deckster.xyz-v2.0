export interface ElementGridGeometry {
  startCol: number
  startRow: number
  width: number
  height: number
}

export interface GetElementGeometryResponse {
  success: true
  action: 'getElementGeometry'
  elementId: string
  position: {
    gridRow: string
    gridColumn: string
  }
  componentType?: string
  component_type?: string
  themeVariantId?: string | null
  theme_variant_id?: string | null
  themeBindings?: Record<string, string> | null
  theme_bindings?: Record<string, string> | null
}

export interface ElementGenerationMetadata {
  componentType: string | null
  themeVariantId: string | null
  themeBindings: Record<string, string> | null
}

const LOGICAL_COLUMN_END = 33
const LOGICAL_ROW_END = 19
const MINOR_GRID_SCALE = 5
const GRID_TOLERANCE = 1e-8

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMinorGridLine(value: number): boolean {
  return Math.abs(value * MINOR_GRID_SCALE - Math.round(value * MINOR_GRID_SCALE)) < GRID_TOLERANCE
}

function normalizeGridLine(value: number): number {
  return Math.round(value * MINOR_GRID_SCALE) / MINOR_GRID_SCALE
}

function parseLogicalSpan(value: unknown, maxEnd: number, fieldName: string): [number, number] {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a logical-grid string`)
  }

  const parts = value.split('/')
  if (parts.length !== 2) {
    throw new Error(`${fieldName} must contain one start/end span`)
  }

  const start = Number(parts[0].trim())
  const end = Number(parts[1].trim())
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`${fieldName} must contain finite grid lines`)
  }
  if (!isMinorGridLine(start) || !isMinorGridLine(end)) {
    throw new Error(`${fieldName} must use 0.2 logical-grid increments`)
  }

  const normalizedStart = normalizeGridLine(start)
  const normalizedEnd = normalizeGridLine(end)
  if (normalizedStart < 1 || normalizedEnd > maxEnd || normalizedEnd <= normalizedStart) {
    throw new Error(`${fieldName} is outside the logical grid or has a non-positive span`)
  }

  return [normalizedStart, normalizedEnd]
}

/**
 * Validate the Layout viewer's getElementGeometry bridge response and convert
 * its logical grid-line spans into the dimensions used by blankElements.
 */
export function parseGetElementGeometryResponse(
  response: unknown,
  expectedElementId: string,
): ElementGridGeometry {
  if (!isRecord(response) || response.success !== true || response.action !== 'getElementGeometry') {
    throw new Error('Invalid getElementGeometry response')
  }
  if (response.elementId !== expectedElementId) {
    throw new Error('getElementGeometry returned a different element ID')
  }
  if (!isRecord(response.position)) {
    throw new Error('getElementGeometry response is missing position')
  }

  const [startRow, endRow] = parseLogicalSpan(response.position.gridRow, LOGICAL_ROW_END, 'gridRow')
  const [startCol, endCol] = parseLogicalSpan(response.position.gridColumn, LOGICAL_COLUMN_END, 'gridColumn')

  return {
    startCol,
    startRow,
    width: normalizeGridLine(endCol - startCol),
    height: normalizeGridLine(endRow - startRow),
  }
}

export function parseElementGenerationMetadata(response: unknown): ElementGenerationMetadata {
  if (!isRecord(response)) {
    return { componentType: null, themeVariantId: null, themeBindings: null }
  }
  const rawBindings = response.themeBindings ?? response.theme_bindings
  const themeBindings = isRecord(rawBindings)
    ? Object.fromEntries(
        Object.entries(rawBindings).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    : null
  return {
    componentType: typeof (response.componentType ?? response.component_type) === 'string'
      ? String(response.componentType ?? response.component_type)
      : null,
    themeVariantId: typeof (response.themeVariantId ?? response.theme_variant_id) === 'string'
      ? String(response.themeVariantId ?? response.theme_variant_id)
      : null,
    themeBindings,
  }
}
