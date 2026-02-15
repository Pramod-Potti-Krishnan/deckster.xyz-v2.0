/**
 * Text Labs API Client
 *
 * Unified client for the Text Labs element generation service.
 * Reuses ELEMENTOR_BASE_URL (same Railway service).
 *
 * API: POST /api/chat/message (all element types)
 * Session: POST /api/canvas/session
 * Infographic upload: POST /api/infographic/generate
 */

import {
  TextLabsFormData,
  TextLabsResponse,
  TextLabsSessionResponse,
  TextLabsAllComponentType,
  TextLabsPositionConfig,
  TextLabsPaddingConfig,
  INSERTION_METHOD_MAP,
  TEXT_LABS_ELEMENT_DEFAULTS,
  InsertionMethod,
  TextLabsComponentType,
} from '@/types/textlabs'

// Same service as Elementor - reuse the URL
const TEXT_LABS_BASE_URL = process.env.NEXT_PUBLIC_ELEMENTOR_URL || 'https://web-production-3b42.up.railway.app'

// ============================================================================
// API KEY MAPPING (camelCase -> snake_case)
// ============================================================================

const CONFIG_KEY_MAP: Record<string, string> = {
  textboxConfig: 'textbox_config',
  metricsConfig: 'metrics_config',
  tableConfig: 'table_config',
  chartConfig: 'chart_config',
  imageConfig: 'image_config',
  iconLabelConfig: 'icon_label_config',
  shapeConfig: 'shape_config',
  infographicConfig: 'infographic_config',
  codeDisplayConfig: 'code_display_config',
  kanbanConfig: 'kanban_config',
  ganttConfig: 'gantt_config',
  chevronConfig: 'chevron_config',
  ideaBoardConfig: 'idea_board_config',
  cloudArchitectureConfig: 'cloud_architecture_config',
  logicalArchitectureConfig: 'logical_architecture_config',
  dataArchitectureConfig: 'data_architecture_config',
  positionConfig: 'position_config',
  paddingConfig: 'padding_config',
  componentType: 'component_type',
  zIndex: 'z_index',
  textOnlyMode: 'text_only_mode',
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export async function createSession(): Promise<TextLabsSessionResponse> {
  const response = await fetch(`${TEXT_LABS_BASE_URL}/api/canvas/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Session creation failed: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${TEXT_LABS_BASE_URL}/health`)
    return response.ok
  } catch {
    return false
  }
}

// ============================================================================
// MESSAGE SENDING
// ============================================================================

interface SendMessageOptions {
  componentType: TextLabsAllComponentType
  positionConfig?: TextLabsPositionConfig
  paddingConfig?: TextLabsPaddingConfig
  zIndex?: number
  textOnlyMode?: boolean
  count?: number
  layout?: 'horizontal' | 'vertical' | 'grid'
  itemsPerInstance?: number
  // Element-specific configs (only one should be set)
  textboxConfig?: Record<string, unknown>
  metricsConfig?: Record<string, unknown>
  tableConfig?: Record<string, unknown>
  chartConfig?: Record<string, unknown>
  imageConfig?: Record<string, unknown>
  iconLabelConfig?: Record<string, unknown>
  shapeConfig?: Record<string, unknown>
  infographicConfig?: Record<string, unknown>
  // Diagram subtype configs
  codeDisplayConfig?: Record<string, unknown>
  kanbanConfig?: Record<string, unknown>
  ganttConfig?: Record<string, unknown>
  chevronConfig?: Record<string, unknown>
  ideaBoardConfig?: Record<string, unknown>
  cloudArchitectureConfig?: Record<string, unknown>
  logicalArchitectureConfig?: Record<string, unknown>
  dataArchitectureConfig?: Record<string, unknown>
}

export async function sendMessage(
  sessionId: string,
  message: string,
  options: SendMessageOptions
): Promise<TextLabsResponse> {
  // Build payload with snake_case keys
  const payload: Record<string, unknown> = {
    session_id: sessionId,
    message,
  }

  // Map all option keys to snake_case
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue
    const snakeKey = CONFIG_KEY_MAP[key] || key
    payload[snakeKey] = value
  }

  const response = await fetch(`${TEXT_LABS_BASE_URL}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// INFOGRAPHIC WITH REFERENCE IMAGE (multipart)
// ============================================================================

export async function generateInfographic(
  sessionId: string,
  message: string,
  referenceImage: File,
  config?: Record<string, unknown>
): Promise<TextLabsResponse> {
  const formData = new FormData()
  formData.append('session_id', sessionId)
  formData.append('message', message)
  formData.append('reference_image', referenceImage)

  if (config) {
    formData.append('infographic_config', JSON.stringify(config))
  }

  const response = await fetch(`${TEXT_LABS_BASE_URL}/api/infographic/generate`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Infographic upload failed: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// FORM DATA -> API PAYLOAD CONVERSION
// ============================================================================

export function buildApiPayload(
  sessionId: string,
  formData: TextLabsFormData
): { sessionId: string; message: string; options: SendMessageOptions } {
  const { prompt, count, layout, advancedModified, z_index, positionConfig, paddingConfig, componentType } = formData

  const options: SendMessageOptions = {
    componentType,
    textOnlyMode: !advancedModified,
    count,
    layout,
    zIndex: z_index,
  }

  if (positionConfig) {
    options.positionConfig = positionConfig
  }

  if (paddingConfig && (paddingConfig.top > 0 || paddingConfig.right > 0 || paddingConfig.bottom > 0 || paddingConfig.left > 0)) {
    options.paddingConfig = paddingConfig
  }

  // IMAGE always sends its config (position is embedded in imageConfig, not separate)
  if (formData.componentType === 'IMAGE') {
    options.imageConfig = formData.imageConfig as Record<string, unknown>
  }

  // Attach element-specific config when user modified advanced settings
  if (advancedModified) {
    switch (formData.componentType) {
      case 'TEXT_BOX':
        options.textboxConfig = formData.textboxConfig as Record<string, unknown>
        options.itemsPerInstance = formData.itemsPerInstance
        break
      case 'METRICS':
        options.metricsConfig = formData.metricsConfig as Record<string, unknown>
        break
      case 'TABLE':
        options.tableConfig = formData.tableConfig as Record<string, unknown>
        break
      case 'CHART':
        options.chartConfig = formData.chartConfig as Record<string, unknown>
        break
      case 'IMAGE':
        // Already handled above
        break
      case 'ICON_LABEL':
        options.iconLabelConfig = formData.iconLabelConfig as Record<string, unknown>
        break
      case 'SHAPE':
        options.shapeConfig = formData.shapeConfig as Record<string, unknown>
        break
      case 'INFOGRAPHIC':
        options.infographicConfig = formData.infographicConfig as Record<string, unknown>
        break
      // Diagram subtypes
      case 'CODE_DISPLAY':
        options.codeDisplayConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'KANBAN_BOARD':
        options.kanbanConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'GANTT_CHART':
        options.ganttConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'CHEVRON_MATURITY':
        options.chevronConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'IDEA_BOARD':
        options.ideaBoardConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'CLOUD_ARCHITECTURE':
        options.cloudArchitectureConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'LOGICAL_ARCHITECTURE':
        options.logicalArchitectureConfig = formData.diagramConfig as Record<string, unknown>
        break
      case 'DATA_ARCHITECTURE':
        options.dataArchitectureConfig = formData.diagramConfig as Record<string, unknown>
        break
    }
  }

  return { sessionId, message: prompt, options }
}

// ============================================================================
// CANVAS INSERTION HELPERS
// ============================================================================

export function getInsertionMethod(componentType: TextLabsAllComponentType): InsertionMethod {
  return INSERTION_METHOD_MAP[componentType] || 'insertElement'
}

export function getDefaultSize(componentType: TextLabsComponentType): { width: number; height: number; zIndex: number } {
  return TEXT_LABS_ELEMENT_DEFAULTS[componentType] || TEXT_LABS_ELEMENT_DEFAULTS.TEXT_BOX
}

/**
 * Extract body content from full HTML documents.
 * Backend returns complete HTML (<!DOCTYPE html>...) but Layout Service expects
 * just body content with scripts. Ported from Text Labs canvas-renderer.js.
 */
function extractBodyContent(html: string): string {
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const headScripts = Array.from(doc.head.querySelectorAll('script'))
    const bodyContent = doc.body.innerHTML
    const scriptTags = headScripts.map(s => s.outerHTML).join('\n')
    return scriptTags + '\n' + bodyContent
  }
  return html
}

/**
 * Build postMessage params for canvas insertion based on element type and API response
 */
export function buildInsertionParams(
  componentType: TextLabsAllComponentType,
  element: { html?: string; image_url?: string },
  positionConfig?: TextLabsPositionConfig,
  paddingConfig?: TextLabsPaddingConfig,
  zIndex?: number,
  slideIndex?: number
): {
  method: InsertionMethod
  params: Record<string, unknown>
} {
  const method = getInsertionMethod(componentType)
  const baseType = isDiagramSubtype(componentType) ? 'DIAGRAM' : componentType as TextLabsComponentType
  const defaults = getDefaultSize(baseType)

  const startCol = positionConfig?.start_col ?? 2
  const startRow = positionConfig?.start_row ?? 4
  const width = positionConfig?.position_width ?? defaults.width
  const height = positionConfig?.position_height ?? defaults.height
  const elementZIndex = zIndex ?? defaults.zIndex

  const elementId = `${baseType.toLowerCase()}_${Date.now()}`
  const gridRow = `${startRow}/${startRow + height}`
  const gridColumn = `${startCol}/${startCol + width}`

  const baseParams: Record<string, unknown> = {
    elementId,
    slideIndex: slideIndex ?? 0,
    gridRow,
    gridColumn,
    positionWidth: width,
    positionHeight: height,
    zIndex: elementZIndex,
    draggable: true,
    resizable: true,
    skipAutoSize: true,
  }

  if (paddingConfig) {
    baseParams.style = {
      padding_top: paddingConfig.top || 0,
      padding_right: paddingConfig.right || 0,
      padding_bottom: paddingConfig.bottom || 0,
      padding_left: paddingConfig.left || 0,
    }
  }

  switch (method) {
    case 'insertElement':
      return {
        method: 'insertElement',
        params: { ...baseParams, content: element.html || '' },
      }
    case 'insertChart':
      return {
        method: 'insertChart',
        params: { ...baseParams, chartHtml: extractBodyContent(element.html || '') },
      }
    case 'insertImage':
      return {
        method: 'insertImage',
        params: { ...baseParams, imageUrl: element.image_url || '', src: element.image_url || '' },
      }
    case 'insertDiagram':
      return {
        method: 'insertDiagram',
        params: { ...baseParams, htmlContent: extractBodyContent(element.html || '') },
      }
  }
}

function isDiagramSubtype(type: TextLabsAllComponentType): boolean {
  return [
    'CODE_DISPLAY', 'KANBAN_BOARD', 'GANTT_CHART', 'CHEVRON_MATURITY',
    'IDEA_BOARD', 'CLOUD_ARCHITECTURE', 'LOGICAL_ARCHITECTURE', 'DATA_ARCHITECTURE',
  ].includes(type)
}

export { TEXT_LABS_BASE_URL }
