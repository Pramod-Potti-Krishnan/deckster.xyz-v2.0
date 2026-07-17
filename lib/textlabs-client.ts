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
  ElementGenerationContext,
  ElementResearchPolicy,
} from '@/types/textlabs'
import { semanticTypeForInsertion } from '@/lib/element-semantic-type'
import { resolveElementThemeMetadata } from '@/lib/textlabs-theme-metadata'
import { parseThemeVariantSource, responseStyleOwner } from '@/lib/element-provenance'

// Same service as Elementor - reuse the URL
const TEXT_LABS_BASE_URL = process.env.NEXT_PUBLIC_ELEMENTOR_URL || 'https://web-production-3b42.up.railway.app'

let elementIdSequence = 0

function nextElementIdSequence(): number {
  elementIdSequence = (elementIdSequence + 1) % Number.MAX_SAFE_INTEGER
  return elementIdSequence
}

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
  presentationId: 'presentation_id',
  slideIndex: 'slide_index',
  useDeckTheme: 'use_deck_theme',
  themeOverrides: 'theme_overrides',
  themeVariantId: 'theme_variant_id',
  themeBindings: 'theme_bindings',
  existingElement: 'existing_element',
  slideContext: 'slide_context',
  deckContext: 'deck_context',
  generationContext: 'generation_context',
  replaceElementId: 'replace_element_id',
  semanticRole: 'semantic_role',
  slotName: 'slot_name',
  slotKind: 'slot_kind',
  accessoryType: 'accessory_type',
  geometryMode: 'geometry_mode',
  manualGeometryOverrides: 'manual_geometry_overrides',
  metricsFitMode: 'metrics_fit_mode',
  manualMetricsOverrides: 'manual_metrics_overrides',
  slotMetadata: 'slot_metadata',
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export async function createSession(
  presentationId?: string | null,
  signal?: AbortSignal,
): Promise<TextLabsSessionResponse> {
  const response = await fetch(`${TEXT_LABS_BASE_URL}/api/canvas/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presentationId ? { presentation_id: presentationId } : {}),
    signal,
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
  presentationId?: string | null
  slideIndex?: number
  useDeckTheme?: boolean
  themeOverrides?: Record<string, unknown> | null
  themeVariantId?: string | null
  themeBindings?: Record<string, string> | null
  refine?: boolean
  existingElement?: Record<string, unknown> | null
  slideContext?: Record<string, unknown> | null
  deckContext?: Record<string, unknown> | null
  generationContext?: ElementGenerationContext | null
  research?: ElementResearchPolicy | null
  replaceElementId?: string | null
  semanticRole?: string | null
  slotName?: string | null
  slotKind?: string | null
  accessoryType?: string | null
  geometryMode?: 'AUTO' | 'MANUAL'
  manualGeometryOverrides?: Record<string, unknown>
  metricsFitMode?: 'AUTO' | 'MANUAL'
  manualMetricsOverrides?: Record<string, unknown>
  slotMetadata?: Record<string, unknown>
  positionConfig?: TextLabsPositionConfig
  paddingConfig?: TextLabsPaddingConfig
  zIndex?: number
  textOnlyMode?: boolean
  count?: number
  layout?: 'horizontal' | 'vertical' | 'grid'
  itemsPerInstance?: number
  structure?: string
  compose?: boolean
  elements?: Array<Record<string, unknown>>
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

type BackendValidationIssue = {
  loc?: unknown
  msg?: unknown
  message?: unknown
}

const METRICS_OVERRIDE_BINDINGS: Record<string, readonly string[]> = {
  color_scheme: ['background', 'color_scheme'],
  color_variant: ['accent', 'color_variant'],
  corners: ['corners', 'corner_radius'],
  border: ['border', 'border_color'],
  value_font_color: ['value_color'],
  value_font_size: ['value_font', 'value_font_size'],
  value_font_family: ['value_font', 'value_font_family'],
  label_font_color: ['label_color'],
  label_font_size: ['label_font', 'label_font_size'],
  label_font_family: ['label_font', 'label_font_family'],
  desc_font_color: ['description_color', 'desc_font_color'],
  desc_font_size: ['description_font', 'desc_font_size'],
  desc_font_family: ['description_font', 'desc_font_family'],
}

/** Detach only caller-owned Metrics treatments from ThemeContract bindings. */
export function detachMetricsOverrideBindings(
  bindings: Record<string, string> | null | undefined,
  metricsConfig: Record<string, unknown> | null | undefined,
): Record<string, string> | null | undefined {
  if (bindings == null || !metricsConfig) return bindings
  const detachedNames = new Set<string>()
  for (const [field, names] of Object.entries(METRICS_OVERRIDE_BINDINGS)) {
    if (Object.prototype.hasOwnProperty.call(metricsConfig, field)) {
      names.forEach(name => detachedNames.add(name))
    }
  }
  if (!detachedNames.size) return bindings
  return Object.fromEntries(
    Object.entries(bindings).filter(([name]) => (
      !detachedNames.has(name.trim().toLowerCase().replaceAll('-', '_'))
    )),
  )
}

/** Turn FastAPI/Pydantic validation payloads into an actionable UI message. */
export function formatBackendError(errorData: unknown, fallback: string): string {
  if (!errorData || typeof errorData !== 'object') return fallback
  const payload = errorData as Record<string, unknown>
  for (const key of ['error', 'message'] as const) {
    if (typeof payload[key] === 'string' && payload[key].trim()) return payload[key].trim()
  }

  const detail = payload.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const issue = detail as BackendValidationIssue
    const message = typeof issue.message === 'string' ? issue.message : issue.msg
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  if (Array.isArray(detail)) {
    const issues = detail.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const issue = item as BackendValidationIssue
      const message = typeof issue.msg === 'string' ? issue.msg : issue.message
      if (typeof message !== 'string' || !message.trim()) return []
      const location = Array.isArray(issue.loc)
        ? issue.loc.filter(part => part !== 'body').map(String).join('.')
        : ''
      return [`${location ? `${location}: ` : ''}${message.trim()}`]
    })
    if (issues.length) return issues.join('; ')
  }
  return fallback
}

export async function sendMessage(
  sessionId: string,
  message: string,
  options: SendMessageOptions,
  signal?: AbortSignal,
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
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(formatBackendError(errorData, `API error: ${response.status}`))
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
  config?: Record<string, unknown>,
  options?: {
    presentationId?: string | null
    slideIndex?: number
    useDeckTheme?: boolean
    themeOverrides?: Record<string, unknown> | null
    themeVariantId?: string | null
    themeBindings?: Record<string, string> | null
    refine?: boolean
    existingElement?: Record<string, unknown> | null
    slideContext?: Record<string, unknown> | null
    deckContext?: Record<string, unknown> | null
    generationContext?: ElementGenerationContext | null
    research?: ElementResearchPolicy | null
  },
  signal?: AbortSignal,
): Promise<TextLabsResponse> {
  const formData = new FormData()
  formData.append('session_id', sessionId)
  formData.append('message', message)
  formData.append('reference_image', referenceImage)
  if (options?.presentationId) formData.append('presentation_id', options.presentationId)
  if (options?.slideIndex !== undefined) formData.append('slide_index', String(options.slideIndex))
  if (options?.useDeckTheme !== undefined) formData.append('use_deck_theme', String(options.useDeckTheme))
  if (options?.themeOverrides) formData.append('theme_overrides', JSON.stringify(options.themeOverrides))
  if (options?.themeVariantId) formData.append('theme_variant_id', options.themeVariantId)
  if (options?.themeBindings) formData.append('theme_bindings', JSON.stringify(options.themeBindings))
  if (options?.refine !== undefined) formData.append('refine', String(options.refine))
  if (options?.existingElement) formData.append('existing_element', JSON.stringify(options.existingElement))
  if (options?.slideContext) formData.append('slide_context', JSON.stringify(options.slideContext))
  if (options?.deckContext) formData.append('deck_context', JSON.stringify(options.deckContext))
  if (options?.generationContext) formData.append('generation_context', JSON.stringify(options.generationContext))
  if (options?.research) formData.append('research', JSON.stringify(options.research))

  if (config) {
    formData.append('infographic_config', JSON.stringify(config))
  }

  const response = await fetch(`${TEXT_LABS_BASE_URL}/api/infographic/generate`, {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(formatBackendError(errorData, `Infographic upload failed: ${response.status}`))
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

  const metricsThemeBindings = componentType === 'METRICS'
    ? detachMetricsOverrideBindings(
        formData.themeBindings,
        formData.metricsConfig as Record<string, unknown> | undefined,
      )
    : formData.themeBindings
  const options: SendMessageOptions = {
    componentType,
    presentationId: formData.presentationId,
    slideIndex: formData.slideIndex,
    useDeckTheme: formData.useDeckTheme,
    themeOverrides: formData.themeOverrides as Record<string, unknown> | null | undefined,
    themeVariantId: formData.themeVariantId,
    themeBindings: metricsThemeBindings,
    refine: formData.refine,
    existingElement: formData.existingElement,
    slideContext: formData.slideContext,
    deckContext: formData.deckContext,
    generationContext: formData.generationContext,
    research: formData.research,
    replaceElementId: formData.replaceElementId,
    // Accessories (currently Logo) are structural slots, not semantic text
    // roles. Text Labs remains backward compatible with its BODY_TEXT default,
    // while Layout persists the accessory identity independently.
    semanticRole: formData.componentType === 'TEXT_BOX' && formData.slotKind !== 'accessory'
      ? formData.semanticRole
      : undefined,
    slotName: formData.slotName,
    slotKind: formData.slotKind,
    accessoryType: formData.accessoryType,
    geometryMode: formData.componentType === 'TEXT_BOX' ? formData.geometryMode : undefined,
    manualGeometryOverrides: formData.componentType === 'TEXT_BOX' && formData.geometryMode === 'MANUAL'
      ? formData.manualGeometryOverrides as Record<string, unknown> | undefined
      : undefined,
    slotMetadata: formData.slotMetadata as Record<string, unknown> | undefined,
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

  if (formData.componentType === 'TEXT_BOX') {
    if (Object.keys(formData.textboxConfig).length > 0) {
      options.textboxConfig = formData.textboxConfig as Record<string, unknown>
    }
    options.structure = formData.structure
    options.compose = formData.compose
    options.elements = formData.elements
  }

  if (formData.componentType === 'METRICS') {
    options.metricsFitMode = formData.metricsFitMode
    if (formData.metricsFitMode === 'MANUAL') {
      options.manualMetricsOverrides = (formData.manualMetricsOverrides ?? {}) as Record<string, unknown>
    }
    if (Object.keys(formData.metricsConfig).length > 0) {
      options.metricsConfig = formData.metricsConfig as Record<string, unknown>
    }
    options.compose = formData.compose
    options.elements = formData.elements?.map(element => {
      const detachedBindings = detachMetricsOverrideBindings(
        element.theme_bindings,
        formData.metricsConfig as Record<string, unknown> | undefined,
      )
      return {
        ...element,
        theme_bindings: detachedBindings,
      }
    })
  }

  if (formData.componentType === 'TABLE') {
    // structure_mode is always explicit; all other table fields are a sparse
    // user-owned patch. AUTO intentionally carries no dimensions or fit knobs.
    options.tableConfig = formData.tableConfig as Record<string, unknown>
  }

  // Attach element-specific config when user modified advanced settings
  if (advancedModified) {
    switch (formData.componentType) {
      case 'TEXT_BOX':
        break
      case 'METRICS':
        break
      case 'TABLE':
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
  element: {
    html?: string
    image_url?: string
    image_data_url?: string
    mode?: string
    grid_position?: Partial<TextLabsPositionConfig> & { width?: number; height?: number }
    theme_variant_id?: string | null
    theme_bindings?: Record<string, string> | null
    style_owner?: string | null
    styleOwner?: string | null
    theme_variant_source?: string | null
    themeVariantSource?: string | null
    research_provenance?: Record<string, unknown> | null
    semantic_role?: string | null
    slot_name?: string | null
    slot_kind?: string | null
    accessory_type?: string | null
    resolved_geometry?: Record<string, unknown> | null
    platinum_profile?: Record<string, unknown> | string | null
    resolved_metrics_profile?: Record<string, unknown> | null
    resolved_table_profile?: Record<string, unknown> | null
    citations_used?: Array<Record<string, unknown>> | null
    metadata?: Record<string, unknown> | null
  },
  positionConfig?: TextLabsPositionConfig,
  paddingConfig?: TextLabsPaddingConfig,
  zIndex?: number,
  slideIndex?: number
): {
  method: InsertionMethod
  params: Record<string, unknown>
} {
  // V2 (structured/deterministic) infographics return self-contained HTML (no raster
  // image); route them through the HTML insert path instead of insertImage, which would
  // feed the HTML string in as an <img src> and render nothing.
  const isV2Infographic =
    componentType === 'INFOGRAPHIC' &&
    (element.mode === 'v2' || (!!element.html && !element.image_url && !element.image_data_url))
  const method: InsertionMethod = isV2Infographic ? 'insertDiagram' : getInsertionMethod(componentType)
  const baseType = isDiagramSubtype(componentType) ? 'DIAGRAM' : componentType as TextLabsComponentType
  const semanticComponentType = semanticTypeForInsertion(componentType)
  const themeMetadata = resolveElementThemeMetadata(element)
  const defaults = getDefaultSize(baseType)

  const gridPosition = element.grid_position
  const startCol = gridPosition?.start_col ?? positionConfig?.start_col ?? 2
  const startRow = gridPosition?.start_row ?? positionConfig?.start_row ?? 4
  const width = gridPosition?.position_width ?? gridPosition?.width ?? positionConfig?.position_width ?? defaults.width
  const height = gridPosition?.position_height ?? gridPosition?.height ?? positionConfig?.position_height ?? defaults.height
  const elementZIndex = zIndex ?? defaults.zIndex

  const elementId = `${baseType.toLowerCase()}_${Date.now()}_${nextElementIdSequence()}`
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
    componentType: semanticComponentType,
  }

  if (themeMetadata.themeVariantId) baseParams.themeVariantId = themeMetadata.themeVariantId
  if (themeMetadata.themeBindings) baseParams.themeBindings = themeMetadata.themeBindings
  const styleOwner = responseStyleOwner(element)
  if (styleOwner) baseParams.styleOwner = styleOwner
  const themeVariantSource = parseThemeVariantSource(
    element.theme_variant_source ?? element.themeVariantSource
      ?? element.metadata?.theme_variant_source ?? element.metadata?.themeVariantSource,
  ) ?? 'element_generation'
  baseParams.themeVariantSource = themeVariantSource
  const researchProvenance = element.research_provenance ?? element.metadata?.research_provenance
  if (researchProvenance) baseParams.researchProvenance = researchProvenance
  const semanticRole = element.semantic_role ?? element.metadata?.semantic_role
  const slotName = element.slot_name ?? element.metadata?.slot_name
  const slotKind = element.slot_kind ?? element.metadata?.slot_kind
  const accessoryType = element.accessory_type ?? element.metadata?.accessory_type
  const resolvedGeometry = element.resolved_geometry ?? element.metadata?.resolved_geometry
  const platinumProfile = element.platinum_profile ?? element.metadata?.platinum_profile
  const resolvedMetricsProfile = element.resolved_metrics_profile ?? element.metadata?.resolved_metrics_profile
  const resolvedTableProfile = element.resolved_table_profile ?? element.metadata?.resolved_table_profile
  const citationsUsed = element.citations_used ?? element.metadata?.citations_used
  if (semanticRole) baseParams.semanticRole = semanticRole
  if (slotName) baseParams.slotName = slotName
  if (slotKind) baseParams.slotKind = slotKind
  if (accessoryType) baseParams.accessoryType = accessoryType
  if (resolvedGeometry) baseParams.resolvedGeometry = resolvedGeometry
  if (platinumProfile) baseParams.platinumProfile = platinumProfile
  if (resolvedMetricsProfile) baseParams.resolvedMetricsProfile = resolvedMetricsProfile
  if (resolvedTableProfile) baseParams.resolvedTableProfile = resolvedTableProfile
  if (citationsUsed) baseParams.citationsUsed = citationsUsed

  if (paddingConfig) {
    baseParams.style = {
      padding_top: paddingConfig.top || 0,
      padding_right: paddingConfig.right || 0,
      padding_bottom: paddingConfig.bottom || 0,
      padding_left: paddingConfig.left || 0,
    }
  }

  switch (method) {
    case 'insertElement': {
      const iconLabelParams = componentType === 'ICON_LABEL' ? { minCols: 1, minRows: 1 } : {}
      return {
        method: 'insertElement',
        params: { ...baseParams, content: element.html || '', ...iconLabelParams },
      }
    }
    case 'insertChart':
      return {
        method: 'insertChart',
        params: { ...baseParams, chartHtml: extractBodyContent(element.html || '') },
      }
    case 'insertImage':
      return {
        method: 'insertImage',
        params: { ...baseParams, imageUrl: element.image_url || element.image_data_url || element.html || '' },
      }
    case 'insertDiagram':
      return {
        method: 'insertDiagram',
        params: { ...baseParams, htmlContent: extractBodyContent(element.html || '') },
      }
  }
}

export function buildSemanticUpsertParams(
  params: Record<string, unknown>,
  slideIndex: number,
  replacesElementId?: string | null,
): Record<string, unknown> | null {
  const citationsUsed = Array.isArray(params.citationsUsed) ? params.citationsUsed : []
  const isLogoAccessory = params.slotKind === 'accessory' && params.accessoryType === 'LOGO'
  const isSemanticText = params.componentType === 'TEXT_BOX' && (
    Boolean(params.slotName) ||
    params.semanticRole !== 'BODY_TEXT' ||
    citationsUsed.length > 0 ||
    Boolean(replacesElementId && params.slotName)
  )
  if (!isLogoAccessory && !isSemanticText) return null

  return {
    elementId: params.elementId,
    ...(replacesElementId ? { replacesElementId } : {}),
    slideIndex,
    content: isLogoAccessory ? params.imageUrl : params.content,
    semanticRole: isLogoAccessory ? undefined : params.semanticRole,
    slotName: params.slotName,
    slotKind: params.slotKind,
    accessoryType: params.accessoryType,
    geometry: params.slotKind === 'body' ? {
      gridRow: params.gridRow,
      gridColumn: params.gridColumn,
    } : undefined,
    citationsUsed,
    metadata: {
      componentType: params.componentType,
      researchProvenance: params.researchProvenance,
      styleOwner: params.styleOwner,
      themeVariantId: params.themeVariantId,
      themeBindings: params.themeBindings,
      resolvedGeometry: params.resolvedGeometry,
      platinumProfile: params.platinumProfile,
    },
  }
}

function isDiagramSubtype(type: TextLabsAllComponentType): boolean {
  return [
    'CODE_DISPLAY', 'KANBAN_BOARD', 'GANTT_CHART', 'CHEVRON_MATURITY',
    'IDEA_BOARD', 'CLOUD_ARCHITECTURE', 'LOGICAL_ARCHITECTURE', 'DATA_ARCHITECTURE',
  ].includes(type)
}

export { TEXT_LABS_BASE_URL }
