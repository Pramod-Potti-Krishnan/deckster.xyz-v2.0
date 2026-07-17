import { parseStyleOwner, parseThemeVariantSource } from '@/lib/element-provenance'

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
  styleOwner?: string | null
  style_owner?: string | null
  themeVariantSource?: string | null
  theme_variant_source?: string | null
  metricsColorVariant?: string | null
  metrics_color_variant?: string | null
}

export interface ElementGenerationMetadata {
  componentType: string | null
  themeVariantId: string | null
  themeBindings: Record<string, string> | null
  styleOwner: string | null
  themeVariantSource: string | null
  metricsColorVariant: string | null
}

export type ElementGenerationPreflightStage = 'geometry' | 'theme_metadata'

export class ElementGenerationPreflightError extends Error {
  readonly stage: ElementGenerationPreflightStage

  constructor(stage: ElementGenerationPreflightStage, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ElementGenerationPreflightError'
    this.stage = stage
  }
}

export interface ElementGenerationSnapshot extends ElementGridGeometry, ElementGenerationMetadata {}

export interface ElementGridPositionConfig {
  start_col: number
  start_row: number
  position_width: number
  position_height: number
}

export interface ReadElementGenerationSnapshotOptions {
  sendCommand: (action: string, params: Record<string, unknown>) => Promise<unknown>
  elementId: string
  componentType: string
  useDeckTheme: boolean
  requiresThemeVariant: boolean
  themeVariantSource?: string | null
  retries?: number
  retryDelayMs?: number
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
    return {
      componentType: null, themeVariantId: null, themeBindings: null,
      styleOwner: null, themeVariantSource: null, metricsColorVariant: null,
    }
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
    styleOwner: parseStyleOwner(response.styleOwner ?? response.style_owner),
    themeVariantSource: parseThemeVariantSource(
      response.themeVariantSource ?? response.theme_variant_source,
    ),
    metricsColorVariant: typeof (response.metricsColorVariant ?? response.metrics_color_variant) === 'string'
      ? String(response.metricsColorVariant ?? response.metrics_color_variant)
      : null,
  }
}

async function sendPreflightCommandWithRetry(
  sendCommand: ReadElementGenerationSnapshotOptions['sendCommand'],
  action: string,
  params: Record<string, unknown>,
  retries: number,
  retryDelayMs: number,
): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await sendCommand(action, params)
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Viewer command failed')
}

/**
 * Read the authoritative live generation state without ever falling back to
 * tracked coordinates. Viewer reloads and autosave can briefly race a command,
 * so each read gets one bounded retry by default.
 */
export async function readElementGenerationSnapshot({
  sendCommand,
  elementId,
  componentType,
  useDeckTheme,
  requiresThemeVariant,
  themeVariantSource = null,
  retries = 1,
  retryDelayMs = 200,
}: ReadElementGenerationSnapshotOptions): Promise<ElementGenerationSnapshot> {
  let geometryResponse: unknown
  let geometry: ElementGridGeometry
  try {
    geometryResponse = await sendPreflightCommandWithRetry(
      sendCommand,
      'getElementGeometry',
      { elementId },
      retries,
      retryDelayMs,
    )
    geometry = parseGetElementGeometryResponse(geometryResponse, elementId)
  } catch (error) {
    throw new ElementGenerationPreflightError(
      'geometry',
      `Unable to read live geometry for ${elementId}`,
      error,
    )
  }

  let metadata = parseElementGenerationMetadata(geometryResponse)
  // Only Layout-owned component variants need the metadata refresh. Leaf-owned
  // elements (chart/table/diagram/etc.) resolve the deck contract in Text Labs;
  // requiring a placeholder variant here couples their generation to an
  // unsupported Layout operation and turns Layout's placeholder `{}` into a
  // false "detach every theme field" instruction.
  if (useDeckTheme && requiresThemeVariant && themeVariantSource === 'element_generation') {
    try {
      const refreshed = await sendPreflightCommandWithRetry(
        sendCommand,
        'refreshElementThemeMetadata',
        { elementId, componentType, themeVariantSource },
        retries,
        retryDelayMs,
      )
      metadata = parseElementGenerationMetadata(refreshed)
      if (!metadata.themeBindings || (requiresThemeVariant && !metadata.themeVariantId)) {
        throw new Error('The placeholder theme treatment is incomplete')
      }
    } catch (error) {
      throw new ElementGenerationPreflightError(
        'theme_metadata',
        `Unable to refresh theme metadata for ${elementId}`,
        error,
      )
    }
  }

  return { ...geometry, ...metadata }
}

function snapLogicalGrid(value: number): number {
  return Number((Math.round(value * MINOR_GRID_SCALE) / MINOR_GRID_SCALE).toFixed(1))
}

/**
 * Preserve a multi-instance layout when its containing placeholder was moved
 * or resized after the side panel calculated the original child positions.
 */
export function remapElementGridPositions<T extends { grid_position: ElementGridPositionConfig }>(
  elements: T[],
  source: ElementGridPositionConfig,
  target: ElementGridPositionConfig,
): T[] {
  if (
    source.position_width <= 0 ||
    source.position_height <= 0 ||
    target.position_width <= 0 ||
    target.position_height <= 0
  ) {
    throw new Error('Multi-element container geometry must have positive dimensions')
  }

  const targetEndCol = snapLogicalGrid(target.start_col + target.position_width)
  const targetEndRow = snapLogicalGrid(target.start_row + target.position_height)

  return elements.map((element) => {
    const position = element.grid_position
    const colStartRatio = (position.start_col - source.start_col) / source.position_width
    const colEndRatio = (position.start_col + position.position_width - source.start_col) / source.position_width
    const rowStartRatio = (position.start_row - source.start_row) / source.position_height
    const rowEndRatio = (position.start_row + position.position_height - source.start_row) / source.position_height

    const startCol = snapLogicalGrid(target.start_col + colStartRatio * target.position_width)
    const endCol = Math.min(
      targetEndCol,
      snapLogicalGrid(target.start_col + colEndRatio * target.position_width),
    )
    const startRow = snapLogicalGrid(target.start_row + rowStartRatio * target.position_height)
    const endRow = Math.min(
      targetEndRow,
      snapLogicalGrid(target.start_row + rowEndRatio * target.position_height),
    )

    return {
      ...element,
      grid_position: {
        start_col: startCol,
        start_row: startRow,
        position_width: Math.max(0.2, snapLogicalGrid(endCol - startCol)),
        position_height: Math.max(0.2, snapLogicalGrid(endRow - startRow)),
      },
    }
  })
}
