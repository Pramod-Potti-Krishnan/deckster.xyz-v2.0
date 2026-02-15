/**
 * Text Labs Type Definitions
 *
 * Types for the Text Labs unified element generation API.
 * All 9 element types + 8 diagram subtypes.
 */

// ============================================================================
// COMPONENT TYPES
// ============================================================================

export type TextLabsComponentType =
  | 'TEXT_BOX'
  | 'METRICS'
  | 'TABLE'
  | 'CHART'
  | 'IMAGE'
  | 'ICON_LABEL'
  | 'SHAPE'
  | 'INFOGRAPHIC'
  | 'DIAGRAM'

// Diagram subtypes (these are component_type values for diagram variants)
export type TextLabsDiagramSubtype =
  | 'CODE_DISPLAY'
  | 'KANBAN_BOARD'
  | 'GANTT_CHART'
  | 'CHEVRON_MATURITY'
  | 'IDEA_BOARD'
  | 'CLOUD_ARCHITECTURE'
  | 'LOGICAL_ARCHITECTURE'
  | 'DATA_ARCHITECTURE'

// All component types including diagram subtypes
export type TextLabsAllComponentType = TextLabsComponentType | TextLabsDiagramSubtype

// ============================================================================
// SHARED CONFIGS
// ============================================================================

export interface TextLabsPositionConfig {
  start_col: number    // 1-32
  start_row: number    // 1-18
  position_width: number   // grid units
  position_height: number  // grid units
  auto_position: boolean
}

export interface TextLabsPaddingConfig {
  top: number      // 0-60px
  right: number
  bottom: number
  left: number
}

// ============================================================================
// TEXT BOX CONFIG
// ============================================================================

export interface TextBoxConfig {
  background: 'colored' | 'transparent'
  shadow: boolean
  corners: 'rounded' | 'square'
  border: boolean
  show_title: boolean
  title_style: 'plain' | 'highlighted' | 'colored-bg' | 'neutral'
  list_style: 'bullets' | 'numbered' | 'plain'
  color_scheme: 'accent'
  layout: 'horizontal' | 'vertical' | 'grid'
  heading_align: 'left' | 'center' | 'right'
  content_align: 'left' | 'center' | 'right'
  placeholder_mode: boolean
  title_min_chars: number
  title_max_chars: number
  item_min_chars: number
  item_max_chars: number
  items_per_instance: number
  theme_mode: 'light' | 'dark'
  color_variant: string | null
  grid_cols: number | null
  // Heading font overrides
  heading_font_color: string | null
  heading_font_size: string | null
  heading_font_family: string | null
  heading_bold: boolean | null
  heading_italic: boolean | null
  heading_underline: boolean | null
  heading_indent: number
  // Content font overrides
  content_font_color: string | null
  content_font_size: string | null
  content_font_family: string | null
  content_bold: boolean | null
  content_italic: boolean | null
  content_underline: boolean | null
  content_indent: number
  content_line_height: string | null
}

// ============================================================================
// METRICS CONFIG
// ============================================================================

export interface MetricsConfig {
  corners: 'rounded' | 'square'
  border: boolean
  alignment: 'left' | 'center' | 'right'
  color_scheme: 'gradient' | 'solid' | 'accent'
  color_variant: string | null
  placeholder_mode: boolean
  value_min_chars: number
  value_max_chars: number
  label_min_chars: number
  label_max_chars: number
  description_min_chars: number
  description_max_chars: number
  // Value font overrides
  value_font_color: string | null
  value_font_size: string | null
  value_font_family: string | null
  value_bold: boolean | null
  value_italic: boolean | null
  value_allcaps: boolean | null
  // Label font overrides
  label_font_color: string | null
  label_font_size: string | null
  label_font_family: string | null
  label_bold: boolean | null
  label_italic: boolean | null
  label_allcaps: boolean | null
  // Description font overrides (backend uses desc_ prefix)
  desc_font_color: string | null
  desc_font_size: string | null
  desc_font_family: string | null
  desc_bold: boolean | null
  desc_italic: boolean | null
  desc_allcaps: boolean | null
}

// ============================================================================
// TABLE CONFIG
// ============================================================================

export interface TableConfig {
  columns: number       // 2-6
  rows: number          // 2-10
  stripe_rows: boolean
  corners: 'rounded' | 'square'
  header_style: 'solid' | 'minimal' | 'accent'
  alignment: 'left' | 'center' | 'right'
  border_style: 'light' | 'medium' | 'heavy' | 'none'
  header_color: string | null
  first_column_bold: boolean
  last_column_bold: boolean
  show_total_row: boolean
  col_balance: 'descriptive' | 'data'
  column_widths: number[]   // per-column width percentages
  placeholder_mode: boolean
  header_min_chars: number
  header_max_chars: number
  cell_min_chars: number
  cell_max_chars: number
  // Header font overrides
  header_font_color: string | null
  header_font_size: string | null
  header_font_family: string | null
  header_bold: boolean | null
  header_italic: boolean | null
  header_allcaps: boolean | null
  // Cell font overrides
  cell_font_color: string | null
  cell_font_size: string | null
  cell_font_family: string | null
  cell_bold: boolean | null
  cell_italic: boolean | null
  cell_allcaps: boolean | null
}

// ============================================================================
// CHART CONFIG
// ============================================================================

export type TextLabsChartType =
  | 'line' | 'bar_vertical' | 'bar_horizontal' | 'pie' | 'doughnut'
  | 'scatter' | 'bubble' | 'radar' | 'polar_area' | 'area'
  | 'area_stacked' | 'bar_grouped' | 'bar_stacked' | 'waterfall'

export interface ChartConfig {
  chart_type: TextLabsChartType
  include_insights: boolean
  series_names: string[]          // parsed from comma-separated input
  placeholder_mode: boolean
  data: unknown[] | null          // null = AI generates, array = custom JSON data
}

// ============================================================================
// IMAGE CONFIG
// ============================================================================

export type TextLabsImageStyle =
  | 'realistic' | 'photo' | 'illustration' | 'brand_graphic'
  | 'flat_vector' | 'isometric' | 'minimal' | 'abstract'

export interface ImageConfig {
  style: TextLabsImageStyle
  quality: 'standard' | 'hd'
  corners: 'square' | 'rounded'
  border: boolean
  placeholder_mode: boolean
  auto_position: boolean
  // IMAGE embeds position inside imageConfig (no separate position_config)
  start_col: number
  start_row: number
  width: number               // grid units
  height: number              // grid units
  grid_row: string            // CSS Grid format: "start_row/end_row"
  grid_column: string         // CSS Grid format: "start_col/end_col"
  aspect_ratio: string        // GCD-reduced, e.g. "12:7"
}

// ============================================================================
// ICON/LABEL CONFIG
// ============================================================================

export interface IconLabelConfig {
  mode: 'icon' | 'label'
  size: 'small' | 'medium' | 'large'
  style: 'flat' | 'pastel' | 'circle' | 'square' | 'circle-outline' | 'square-outline'
  font: 'poppins' | 'inter' | 'playfair' | 'roboto_mono'
  color: string | null
}

// ============================================================================
// SHAPE CONFIG
// ============================================================================

export type TextLabsShapeType =
  | 'circle' | 'rectangle' | 'triangle' | 'star'
  | 'diamond' | 'arrow' | 'polygon' | 'custom'

export interface ShapeConfig {
  shape_type: TextLabsShapeType | null   // null when custom
  prompt: string | null                  // used when custom shape
  sides: number | null                   // 3-12, only for polygon
  fill_color: string
  stroke_color: string
  stroke_width: number                   // 0-20
  opacity: number                        // 0-1
  rotation: number                       // 0-359 degrees
  size: 'small' | 'medium' | 'large'
  // Pixel-based positioning (primary)
  x: number               // 0-1919
  y: number               // 0-1079
  width_px: number         // 1-1920
  height_px: number        // 1-1080
  // Grid-based positioning (derived from pixel)
  start_col: number
  start_row: number
  position_width: number
  position_height: number
}

// ============================================================================
// INFOGRAPHIC CONFIG
// ============================================================================

export interface InfographicConfig {
  aspect_ratio: 'auto' | '16:9' | '4:3' | '1:1' | '3:2' | '9:16'
  segments: 'auto' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
  crop_mode: 'shape' | 'rectangle'
  target_background: 'light' | 'dark'
  fill_internal: boolean
  placeholder_mode: boolean
  // Position (embedded like IMAGE)
  grid_row: string
  grid_column: string
  start_col: number
  start_row: number
  width: number
  height: number
}

// ============================================================================
// DIAGRAM SUBTYPE CONFIGS
// ============================================================================

export interface CodeDisplayConfig {
  language: string
  color_theme: 'github_dark' | 'github_light' | 'monokai' | 'dracula' | 'solarized' | 'nord'
  text_size: 'small' | 'medium' | 'large'
  show_line_numbers: boolean
  show_copy_button: boolean
  corner_style: 'rounded' | 'square'
  position_preset: string        // Mapped from size + position (e.g., 'full_content', 'left_half')
}

export interface KanbanConfig {
  column_count: number    // 2-6
  theme: 'default' | 'dark' | 'minimal'
  position_preset: string
}

export interface GanttConfig {
  time_unit: 'days' | 'weeks' | 'months' | 'quarters'
  theme: 'default' | 'dark' | 'minimal'
  position_preset: string
}

export interface ChevronConfig {
  num_stages: number      // 3-8
  theme: 'default' | 'dark' | 'minimal'
  time_unit: 'months' | 'quarters' | 'years'
  position_preset: string
}

export interface IdeaBoardConfig {
  axis_preset: 'impact_urgency' | 'impact_effort' | 'risk_reward' | 'custom'
  theme: 'default' | 'dark' | 'minimal'
  position_preset: string
}

export interface CloudArchitectureConfig {
  provider: 'aws' | 'azure' | 'gcp'
  show_layers: boolean
  position_preset: string
}

export interface LogicalArchitectureConfig {
  position_preset: string
}

export interface DataArchitectureConfig {
  show_data_types: boolean
  show_nullable: boolean
  position_preset: string
}

// ============================================================================
// FORM DATA UNION TYPE
// ============================================================================

export interface TextLabsBaseFormData {
  prompt: string
  count: number
  layout: 'horizontal' | 'vertical' | 'grid'
  advancedModified: boolean
  z_index: number
  positionConfig?: TextLabsPositionConfig
  paddingConfig?: TextLabsPaddingConfig
}

export interface TextBoxFormData extends TextLabsBaseFormData {
  componentType: 'TEXT_BOX'
  itemsPerInstance: number
  textboxConfig: Partial<TextBoxConfig>
}

export interface MetricsFormData extends TextLabsBaseFormData {
  componentType: 'METRICS'
  metricsConfig: Partial<MetricsConfig>
}

export interface TableFormData extends TextLabsBaseFormData {
  componentType: 'TABLE'
  tableConfig: Partial<TableConfig>
}

export interface ChartFormData extends TextLabsBaseFormData {
  componentType: 'CHART'
  chartConfig: Partial<ChartConfig>
}

export interface ImageFormData extends TextLabsBaseFormData {
  componentType: 'IMAGE'
  imageConfig: Partial<ImageConfig>
}

export interface IconLabelFormData extends TextLabsBaseFormData {
  componentType: 'ICON_LABEL'
  iconLabelConfig: Partial<IconLabelConfig>
}

export interface ShapeFormData extends TextLabsBaseFormData {
  componentType: 'SHAPE'
  shapeConfig: Partial<ShapeConfig>
}

export interface InfographicFormData extends TextLabsBaseFormData {
  componentType: 'INFOGRAPHIC'
  infographicConfig: Partial<InfographicConfig>
  referenceImage?: File | null
}

export interface DiagramFormData extends TextLabsBaseFormData {
  componentType: TextLabsDiagramSubtype
  diagramConfig: Partial<
    CodeDisplayConfig | KanbanConfig | GanttConfig | ChevronConfig |
    IdeaBoardConfig | CloudArchitectureConfig | LogicalArchitectureConfig | DataArchitectureConfig
  >
}

export type TextLabsFormData =
  | TextBoxFormData
  | MetricsFormData
  | TableFormData
  | ChartFormData
  | ImageFormData
  | IconLabelFormData
  | ShapeFormData
  | InfographicFormData
  | DiagramFormData

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface TextLabsElement {
  html?: string
  image_url?: string
  image_data_url?: string
  component_type: TextLabsAllComponentType
}

export interface TextLabsResponse {
  element?: TextLabsElement
  elements?: TextLabsElement[]
  error?: string
  message?: string
}

export interface TextLabsSessionResponse {
  session_id: string
  status?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const GRID_COLS = 32
export const GRID_ROWS = 18
export const GRID_CELL_SIZE = 60

export const TEXT_LABS_ELEMENT_DEFAULTS: Record<TextLabsComponentType, {
  width: number
  height: number
  zIndex: number
}> = {
  TEXT_BOX: { width: 10, height: 6, zIndex: 50 },
  METRICS: { width: 8, height: 5, zIndex: 90 },
  TABLE: { width: 16, height: 8, zIndex: 50 },
  CHART: { width: 16, height: 12, zIndex: 50 },
  IMAGE: { width: 12, height: 7, zIndex: 75 },
  ICON_LABEL: { width: 2, height: 2, zIndex: 90 },
  SHAPE: { width: 3, height: 3, zIndex: 10 },
  INFOGRAPHIC: { width: 16, height: 9, zIndex: 50 },
  DIAGRAM: { width: 30, height: 14, zIndex: 50 },
}

export const POSITION_PRESETS: Record<string, {
  label: string
  start_col: number
  start_row: number
  width: number
  height: number
}> = {
  'full': { label: 'Full', start_col: 2, start_row: 4, width: 30, height: 14 },
  'half-left': { label: 'Left Half', start_col: 2, start_row: 4, width: 15, height: 14 },
  'half-right': { label: 'Right Half', start_col: 17, start_row: 4, width: 15, height: 14 },
  'quarter-tl': { label: 'Top Left', start_col: 2, start_row: 4, width: 15, height: 7 },
  'quarter-tr': { label: 'Top Right', start_col: 17, start_row: 4, width: 15, height: 7 },
  'quarter-bl': { label: 'Bottom Left', start_col: 2, start_row: 11, width: 15, height: 7 },
  'quarter-br': { label: 'Bottom Right', start_col: 17, start_row: 11, width: 15, height: 7 },
  'center-wide': { label: 'Center Wide', start_col: 4, start_row: 5, width: 24, height: 12 },
  'center-square': { label: 'Center Square', start_col: 8, start_row: 4, width: 14, height: 14 },
}

// IMAGE position presets (same grid system as POSITION_PRESETS)
export const IMAGE_POSITION_PRESETS: Record<string, {
  label: string
  start_col: number
  start_row: number
  width: number
  height: number
}> = {
  'full': { label: 'Full', start_col: 2, start_row: 4, width: 30, height: 14 },
  'half-left': { label: 'Left Half', start_col: 2, start_row: 4, width: 15, height: 14 },
  'half-right': { label: 'Right Half', start_col: 17, start_row: 4, width: 15, height: 14 },
  'quarter-tl': { label: 'Top Left', start_col: 2, start_row: 4, width: 15, height: 7 },
  'quarter-tr': { label: 'Top Right', start_col: 17, start_row: 4, width: 15, height: 7 },
  'quarter-bl': { label: 'Bottom Left', start_col: 2, start_row: 11, width: 15, height: 7 },
  'quarter-br': { label: 'Bottom Right', start_col: 17, start_row: 11, width: 15, height: 7 },
  'center-wide': { label: 'Center Wide', start_col: 4, start_row: 5, width: 24, height: 12 },
  'center-square': { label: 'Center Square', start_col: 8, start_row: 4, width: 14, height: 14 },
}

// Canvas insertion method routing
export type InsertionMethod = 'insertElement' | 'insertChart' | 'insertImage' | 'insertDiagram'

export const INSERTION_METHOD_MAP: Record<TextLabsAllComponentType, InsertionMethod> = {
  TEXT_BOX: 'insertElement',
  METRICS: 'insertElement',
  TABLE: 'insertElement',
  SHAPE: 'insertElement',
  CHART: 'insertChart',
  IMAGE: 'insertImage',
  ICON_LABEL: 'insertElement',
  INFOGRAPHIC: 'insertImage',
  CODE_DISPLAY: 'insertDiagram',
  KANBAN_BOARD: 'insertDiagram',
  GANTT_CHART: 'insertDiagram',
  CHEVRON_MATURITY: 'insertDiagram',
  IDEA_BOARD: 'insertDiagram',
  CLOUD_ARCHITECTURE: 'insertDiagram',
  LOGICAL_ARCHITECTURE: 'insertDiagram',
  DATA_ARCHITECTURE: 'insertDiagram',
  // DIAGRAM is a generic fallback
  DIAGRAM: 'insertDiagram',
}

// Component type display info
export const COMPONENT_TYPE_INFO: Record<TextLabsComponentType, {
  label: string
  icon: string
  description: string
}> = {
  TEXT_BOX: { label: 'Text Box', icon: 'Type', description: 'Rich text content with title and bullets' },
  METRICS: { label: 'Metrics', icon: 'TrendingUp', description: 'KPI cards with values and labels' },
  TABLE: { label: 'Table', icon: 'Table', description: 'Data table with headers and rows' },
  CHART: { label: 'Chart', icon: 'BarChart3', description: '14 chart types with custom data' },
  IMAGE: { label: 'Image', icon: 'Image', description: 'AI-generated images in 10 styles' },
  ICON_LABEL: { label: 'Icon/Label', icon: 'Tag', description: 'Icon or text label element' },
  SHAPE: { label: 'Shape', icon: 'Pentagon', description: 'SVG shapes with 8 types' },
  INFOGRAPHIC: { label: 'Infographic', icon: 'LayoutGrid', description: 'Visual data representation' },
  DIAGRAM: { label: 'Diagram', icon: 'GitBranch', description: '8 diagram types' },
}

// ============================================================================
// TEXT BOX CALCULATION CONSTANTS
// ============================================================================

export const TEXTBOX_CALC = {
  GRID_PX: 60,
  TITLE_CHAR_W: 14,
  BODY_CHAR_W: 12,
  BOX_PAD_H: 80,
  LIST_PAD_PX: 24,
  VERT_PAD_PX: 100,
  TITLE_HEIGHT_PX: 60,
  BULLET_HEIGHT_PX: 37,
  INSTANCE_GAP: 1,
  MAX_FACTOR: 0.95,
  MIN_FACTOR: 0.75,
  MIN_CHARS: 5,
  MAX_TITLE_CHARS: 200,
  MAX_BODY_CHARS: 500,
  MIN_BULLETS: 1,
  MAX_BULLETS: 14,
} as const

export interface TextBoxCalcResult {
  title_min_chars: number
  title_max_chars: number
  item_min_chars: number
  item_max_chars: number
  items_per_instance: number
}

/**
 * Recalculate text box char limits and items/instance based on position, count,
 * layout, padding, font size, indent, and line height.
 * Implements the 10-step chain from the backend reference.
 */
export function recalcTextBoxLimits(params: {
  position_width: number   // grid units
  position_height: number  // grid units
  count: number
  layout: 'horizontal' | 'vertical' | 'grid'
  grid_cols: number | null
  padding_left: number     // px
  padding_right: number    // px
  padding_top: number      // px
  padding_bottom: number   // px
  heading_font_size: string | null  // e.g. '24px'
  content_font_size: string | null  // e.g. '16px'
  heading_indent: number   // 0-5
  content_indent: number   // 0-5
  content_line_height: string | null // e.g. '1.5' or 'auto'
}): TextBoxCalcResult {
  const C = TEXTBOX_CALC

  // Step 1: Total pixel area
  const totalW = params.position_width * C.GRID_PX
  const totalH = params.position_height * C.GRID_PX

  // Step 2: Usable area after padding
  const usableW = totalW - params.padding_left - params.padding_right
  const usableH = totalH - params.padding_top - params.padding_bottom

  // Step 3: Instance count per row/col based on layout
  let colsPerRow = params.count
  let rowsOfInstances = 1
  if (params.layout === 'vertical') {
    colsPerRow = 1
    rowsOfInstances = params.count
  } else if (params.layout === 'grid' && params.grid_cols) {
    colsPerRow = params.grid_cols
    rowsOfInstances = Math.ceil(params.count / params.grid_cols)
  }

  // Step 4: Per-instance dimensions
  const gapW = (colsPerRow - 1) * C.INSTANCE_GAP * C.GRID_PX
  const gapH = (rowsOfInstances - 1) * C.INSTANCE_GAP * C.GRID_PX
  const instanceW = Math.max(60, (usableW - gapW) / colsPerRow)
  const instanceH = Math.max(60, (usableH - gapH) / rowsOfInstances)

  // Step 5: Content area within each instance (subtract box padding)
  const contentW = instanceW - C.BOX_PAD_H
  const contentH = instanceH - C.VERT_PAD_PX

  // Step 6: Parse font sizes
  const headingFontPx = params.heading_font_size ? parseInt(params.heading_font_size) : 24
  const contentFontPx = params.content_font_size ? parseInt(params.content_font_size) : 16

  // Step 7: Derive char widths from font size ratio
  const titleCharW = C.TITLE_CHAR_W * (headingFontPx / 24)
  const bodyCharW = C.BODY_CHAR_W * (contentFontPx / 16)

  // Step 8: Indent reduces usable width
  const headingIndentPx = params.heading_indent * 20
  const contentIndentPx = params.content_indent * 20
  const titleLineW = Math.max(60, contentW - headingIndentPx - C.LIST_PAD_PX)
  const bodyLineW = Math.max(60, contentW - contentIndentPx - C.LIST_PAD_PX)

  // Step 9: Calculate char limits
  const titleCharsPerLine = Math.floor(titleLineW / titleCharW)
  const bodyCharsPerLine = Math.floor(bodyLineW / bodyCharW)

  const title_max_chars = Math.min(C.MAX_TITLE_CHARS, Math.max(C.MIN_CHARS, Math.floor(titleCharsPerLine * C.MAX_FACTOR)))
  const title_min_chars = Math.max(C.MIN_CHARS, Math.floor(titleCharsPerLine * C.MIN_FACTOR))

  const item_max_chars = Math.min(C.MAX_BODY_CHARS, Math.max(C.MIN_CHARS, Math.floor(bodyCharsPerLine * C.MAX_FACTOR)))
  const item_min_chars = Math.max(C.MIN_CHARS, Math.floor(bodyCharsPerLine * C.MIN_FACTOR))

  // Step 10: Calculate items_per_instance from available height
  const lineH = params.content_line_height && params.content_line_height !== 'auto'
    ? contentFontPx * parseFloat(params.content_line_height)
    : C.BULLET_HEIGHT_PX
  const availableH = contentH - C.TITLE_HEIGHT_PX
  const rawItems = Math.floor(availableH / lineH)
  const items_per_instance = Math.max(C.MIN_BULLETS, Math.min(C.MAX_BULLETS, rawItems))

  // Step 11: Tiered multi-line multiplier for body char limits
  const multiplier = items_per_instance <= 7 ? 1 : items_per_instance <= 15 ? 2 : 3
  const item_max_chars_scaled = Math.min(C.MAX_BODY_CHARS, item_max_chars * multiplier)
  const item_min_chars_scaled = Math.max(C.MIN_CHARS, item_min_chars * multiplier)

  return {
    title_min_chars,
    title_max_chars,
    item_min_chars: item_min_chars_scaled,
    item_max_chars: item_max_chars_scaled,
    items_per_instance,
  }
}
