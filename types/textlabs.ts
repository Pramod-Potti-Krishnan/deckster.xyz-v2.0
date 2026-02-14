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
  background: 'colored' | 'white' | 'transparent'
  shadow: boolean
  corners: 'rounded' | 'square'
  border: boolean
  show_title: boolean
  title_style: 'plain' | 'underline' | 'bold-line'
  list_style: 'bullets' | 'numbered' | 'none' | 'dashes'
  color_scheme: 'accent'
  layout: 'horizontal' | 'vertical'
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
  color_scheme: 'gradient' | 'solid' | 'outline' | 'accent'
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
  header_style: 'solid' | 'gradient' | 'outline' | 'minimal'
  alignment: 'left' | 'center' | 'right'
  border_style: 'light' | 'medium' | 'heavy' | 'none'
  header_color: string | null
  first_column_bold: boolean
  last_column_bold: boolean
  show_total_row: boolean
  col_balance: 'descriptive' | 'equal'
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
  | 'area_stacked' | 'bar_grouped' | 'bar_stacked' | 'waterfall' | 'treemap'

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
  | 'realistic' | 'illustration' | 'watercolor' | '3d_render'
  | 'flat_design' | 'minimalist' | 'abstract' | 'photographic'
  | 'cinematic' | 'artistic'

export interface ImageConfig {
  style: TextLabsImageStyle
  quality: 'standard' | 'hd'
  corners: 'square' | 'rounded' | 'pill'
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
  size: 'xs' | 'small' | 'medium' | 'large'
  style: 'flat' | 'pastel' | 'circle' | 'square' | 'circle-outline' | 'square-outline'
  font: 'poppins' | 'inter' | 'playfair' | 'roboto_mono'
  color: string | null
}

// ============================================================================
// SHAPE CONFIG
// ============================================================================

export type TextLabsShapeType =
  // Basic
  | 'circle' | 'ellipse' | 'square' | 'rectangle' | 'triangle'
  // Polygons
  | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon' | 'polygon'
  // Quadrilaterals
  | 'rhombus' | 'parallelogram' | 'trapezoid' | 'kite'
  // Special
  | 'star' | 'cross' | 'arrow' | 'heart' | 'cloud' | 'crescent' | 'doughnut'
  // Lines
  | 'line-horizontal' | 'line-vertical' | 'line-diagonal'
  // AI Generated
  | 'custom'

export interface ShapeConfig {
  shape_type: TextLabsShapeType | null   // null when custom
  prompt: string | null                  // used when custom shape
  sides: number | null                   // 3-12, only for polygon
  fill_color: string
  stroke_color: string
  stroke_width: number
  opacity: number         // 0-1
  rotation: number        // degrees
  size: 'small' | 'medium' | 'large'
  // Grid-based positioning
  start_col: number
  start_row: number
  position_width: number
  position_height: number
  // Pixel-based positioning (derived from grid)
  x: number
  y: number
  width_px: number
  height_px: number
}

// ============================================================================
// INFOGRAPHIC CONFIG
// ============================================================================

export interface InfographicConfig {
  aspect_ratio: '16:9' | '4:3' | '1:1' | 'custom'
  segments: number
  crop_mode: 'fit' | 'fill' | 'stretch'
  target_background: string | null
  fill_internal: boolean
  placeholder_mode: boolean
}

// ============================================================================
// DIAGRAM SUBTYPE CONFIGS
// ============================================================================

export interface CodeDisplayConfig {
  language: string
  color_theme: 'dark' | 'light' | 'monokai' | 'github'
  text_size: 'small' | 'medium' | 'large'
  show_line_numbers: boolean
  show_copy_button: boolean
  corner_style: 'rounded' | 'square'
  size: 'compact' | 'standard' | 'large'
  position_preset: string
}

export interface KanbanConfig {
  column_count: number    // 3-6
  theme: string
  position_preset: string
}

export interface GanttConfig {
  time_unit: 'days' | 'weeks' | 'months' | 'quarters'
  theme: string
  position_preset: string
}

export interface ChevronConfig {
  num_stages: number      // 3-7
  theme: string
  time_unit: 'days' | 'weeks' | 'months' | 'quarters'
  position_preset: string
}

export interface IdeaBoardConfig {
  axis_preset: 'impact_effort' | 'value_complexity' | 'risk_reward' | 'custom'
  theme: string
  position_preset: string
}

export interface CloudArchitectureConfig {
  provider: 'aws' | 'azure' | 'gcp' | 'generic'
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
  layout: 'horizontal' | 'vertical'
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

// Canvas insertion method routing
export type InsertionMethod = 'insertElement' | 'insertChart' | 'insertImage' | 'insertDiagram'

export const INSERTION_METHOD_MAP: Record<TextLabsAllComponentType, InsertionMethod> = {
  TEXT_BOX: 'insertElement',
  METRICS: 'insertElement',
  TABLE: 'insertElement',
  SHAPE: 'insertElement',
  CHART: 'insertChart',
  IMAGE: 'insertImage',
  ICON_LABEL: 'insertImage',
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
  CHART: { label: 'Chart', icon: 'BarChart3', description: '15 chart types with custom data' },
  IMAGE: { label: 'Image', icon: 'Image', description: 'AI-generated images in 10 styles' },
  ICON_LABEL: { label: 'Icon/Label', icon: 'Tag', description: 'Icon or text label element' },
  SHAPE: { label: 'Shape', icon: 'Pentagon', description: 'SVG shapes with 25 types' },
  INFOGRAPHIC: { label: 'Infographic', icon: 'LayoutGrid', description: 'Visual data representation' },
  DIAGRAM: { label: 'Diagram', icon: 'GitBranch', description: '8 diagram types' },
}
