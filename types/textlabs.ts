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

export interface ThemePalette {
  primary?: string
  secondary?: string
  accents?: string[]
  text?: string
  background?: string
  mode?: 'light' | 'dark'
}

export type ThemeSourceMode = 'deck' | 'none' | 'another'

export interface ThemeSourceSelection {
  mode: ThemeSourceMode
  overrides?: ThemePalette | null
}

export type ElementResearchMode = 'on' | 'off'

export interface ElementResearchSourceCapability {
  available: boolean
  code?: string | null
  reason?: string | null
}

export interface ElementResearchCapabilities {
  web: ElementResearchSourceCapability
  uploaded_documents: ElementResearchSourceCapability
  knowledge_graph: ElementResearchSourceCapability
}

export interface ElementResearchPolicy {
  mode: ElementResearchMode
  web?: boolean
  uploaded_docs?: boolean
  use_knowledge_graph?: boolean
  user_id?: string | null
  store_name?: string | null
  session_id?: string | null
  source_capabilities?: ElementResearchCapabilities
  depth?: 'quick' | 'standard'
}

export interface ElementGenerationContext {
  generation_intent: {
    user_prompt: string
    component_type: TextLabsAllComponentType
  }
  reference_context: {
    slide?: Record<string, unknown> | null
    deck?: Record<string, unknown> | null
  }
}

export type TextBoxStructure =
  | 'classic'
  | 'vertical'
  | 'mixed'
  | 'simple'
  | 'SEQUENTIAL'
  | 'COMPARISON'
  | 'SECTIONS'
  | 'CALLOUT'
  | 'TEXT_BULLETS'
  | 'BULLET_BOX'
  | 'NUMBERED_LIST'

export type TextSemanticRole =
  | 'BODY_TEXT'
  | 'SLIDE_TITLE'
  | 'SLIDE_SUBTITLE'
  | 'PRESENTATION_TITLE'
  | 'PRESENTATION_SUBTITLE'
  | 'EYEBROW'
  | 'AUTHOR_INFO'
  | 'SECTION_NUMBER'
  | 'SECTION_TITLE'
  | 'SECTION_SUBTITLE'
  | 'CLOSING_TITLE'
  | 'CLOSING_SUBTITLE'
  | 'CONTACT_INFO'
  | 'QUOTE_ATTRIBUTION'
  | 'FOOTER'
  | 'SOURCES'

export type TextGeometryMode = 'AUTO' | 'MANUAL'
export type TextSlotKind = 'body' | 'structural' | 'system' | 'accessory'

export interface TextManualGeometryOverrides {
  title_min_chars?: number
  title_max_chars?: number
  item_min_chars?: number
  item_max_chars?: number
  items_per_box?: number
  heading_font_size_px?: number
  content_font_size_px?: number
  line_height?: number
  padding_px?: number | { top?: number; right?: number; bottom?: number; left?: number }
  bullet_gap_px?: number
  max_lines?: number
  max_chars?: number
}

export interface TextSlotMetadata {
  geometry?: {
    grid_width?: number
    grid_height?: number
    start_col?: number
    start_row?: number
  }
  typography?: Record<string, unknown>
  single_instance?: boolean
  system_managed?: boolean
  kind?: TextSlotKind
}

export interface TemplateTextSlot {
  slot_name: string
  label: string
  role?: TextSemanticRole | null
  kind: TextSlotKind
  accessory_type?: 'LOGO' | string | null
  supported: boolean
  optional?: boolean
  single_instance?: boolean
  system_managed?: boolean
  geometry?: Partial<TextLabsPositionConfig> | null
  typography?: Record<string, unknown> | null
}

export interface TemplateSlotCatalog {
  canvas_type?: string | null
  template_id?: string | null
  slots: TemplateTextSlot[]
}

// ============================================================================
// TEXT BOX CONFIG
// ============================================================================

export type TextBoxTitleStyle =
  | 'plain'
  | 'highlighted'
  | 'colored-bg'
  | 'neutral'
  | 'light-bg'
  | 'light-bg-dark'
  | 'underline'
  | 'colored_underline'

export interface TextBoxConfig {
  background: 'colored' | 'transparent'
  shadow: boolean
  corners: 'rounded' | 'square'
  border: boolean
  show_title: boolean
  title_style: TextBoxTitleStyle
  title_underline: boolean
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
  simple_subtype?: 'char' | 'word' | 'phrase' | null
  target_char_count?: number | null
  text?: string | null
  opacity?: number | null
}

// ============================================================================
// METRICS CONFIG
// ============================================================================

export interface MetricsConfig {
  corners: 'rounded' | 'square'
  border: boolean
  alignment: 'left' | 'center' | 'right'
  color_scheme: 'gradient' | 'solid' | 'accent' | 'transparent' | 'bordered'
  layout?: 'horizontal' | 'vertical' | 'grid'
  color_variant: string | null
  trend?: 'arrow' | 'pill' | null
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

export type MetricsFitMode = 'AUTO' | 'MANUAL'

/** Fields in this object are user-owned only when explicitly present. */
export interface MetricsManualOverrides {
  value_min_chars?: number
  value_max_chars?: number
  label_min_chars?: number
  label_max_chars?: number
  description_min_chars?: number
  description_max_chars?: number
  value_font_size?: string
  label_font_size?: string
  desc_font_size?: string
  padding_px?: number
  value_margin_bottom_px?: number
  label_margin_bottom_px?: number
}

// ============================================================================
// TABLE CONFIG
// ============================================================================

export type TableStructureMode = 'AUTO' | 'MANUAL'
export type TableColumnKind = 'label' | 'tag' | 'numeric' | 'currency' | 'percent' | 'status' | 'single_line' | 'multi_line' | 'bullets'
export type TableTargetLength = 'short' | 'medium' | 'long'

export interface TableColumnBrief {
  index: number
  name: string
  kind: TableColumnKind
  detail: string
  target_len: TableTargetLength
  width_share?: number
}

export interface TableColumnConfig {
  col: number
  alignment?: 'left' | 'center' | 'right'
  emphasis?: 'normal' | 'bold'
  format?: 'text' | 'number' | 'percent' | 'currency' | 'boolean'
  content_kind?: 'label' | 'tag' | 'numeric' | 'single_line' | 'multi_line' | 'bullets'
  cell_max_chars?: number
}

export interface TableCellMark {
  row: number
  col: number
  mark: 'trend_up' | 'trend_down' | 'flat' | 'good' | 'bad' | 'warn' | 'highlight'
  style: 'arrow' | 'pill' | 'tint' | 'chip'
}

/** Every field except structure_mode is caller-owned only when explicitly present. */
export interface TableConfig {
  structure_mode: TableStructureMode
  columns?: number       // 2-6; MANUAL only
  rows?: number          // 1-10; MANUAL only
  stripe_rows?: boolean
  corners?: 'rounded' | 'square'
  header_style?: 'solid' | 'minimal' | 'accent' | 'pastel'
  alignment?: 'left' | 'center' | 'right'
  border_style?: 'light' | 'medium' | 'heavy' | 'none'
  header_color?: string | null
  first_column_bold?: boolean
  last_column_bold?: boolean
  show_total_row?: boolean
  col_balance?: 'descriptive' | 'data'
  column_widths?: number[]
  column_brief?: TableColumnBrief[]
  column_config?: TableColumnConfig[]
  cell_marks?: TableCellMark[]
  total_row_style?: 'bold' | 'filled'
  total_row_fill?: string
  total_row_rule_color?: string
  density?: 'compact' | 'regular' | 'spacious'
  fit_mode?: 'fill' | 'natural'
  show_mark_legend?: boolean
  mark_legend_labels?: Record<string, string>
  dark_overrides?: Record<string, string> | null
  row_background?: string | null
  row_alt_background?: string | null
  placeholder_mode?: boolean
  header_min_chars?: number
  header_max_chars?: number
  cell_min_chars?: number
  cell_max_chars?: number
  // Header font overrides
  header_font_color?: string | null
  header_font_size?: string | null
  header_font_family?: string | null
  header_bold?: boolean | null
  header_italic?: boolean | null
  header_allcaps?: boolean | null
  // Cell font overrides
  cell_font_color?: string | null
  cell_font_size?: string | null
  cell_font_family?: string | null
  cell_bold?: boolean | null
  cell_italic?: boolean | null
  cell_allcaps?: boolean | null
}

// ============================================================================
// CHART CONFIG
// ============================================================================

export type TextLabsChartType =
  | 'auto' | 'line' | 'bar_vertical' | 'bar_horizontal' | 'pie' | 'doughnut'
  | 'scatter' | 'bubble' | 'radar' | 'polar_area' | 'area'
  | 'area_stacked' | 'bar_grouped' | 'bar_stacked' | 'waterfall'

export interface ChartConfig {
  chart_type: TextLabsChartType
  include_insights: boolean
  series_names: string[]          // parsed from comma-separated input
  placeholder_mode: boolean
  data: unknown[] | null          // null = AI generates, array = custom JSON data
  colors?: string[] | null
  color_mode?: 'multi' | 'same' | 'transparency' | null
  chart_font?: string | null
}

// ============================================================================
// IMAGE CONFIG
// ============================================================================

export type TextLabsImageStyle =
  | 'realistic' | 'photo' | 'illustration' | 'brand_graphic'
  | 'flat_vector' | 'isometric' | 'minimal' | 'abstract'

export interface ImageConfig {
  style: TextLabsImageStyle
  quality: 'draft' | 'standard' | 'high' | 'ultra'
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
  size: 'xs' | 'small' | 'medium' | 'large'
  style: 'flat' | 'pastel' | 'circle' | 'square' | 'circle-outline' | 'square-outline'
  font: 'poppins' | 'inter' | 'playfair' | 'roboto_mono'
  color: string | null
  target_background?: string | null
  exclude_icons?: string[]
}

// ============================================================================
// SHAPE CONFIG
// ============================================================================

export type TextLabsShapeType =
  | 'circle' | 'ellipse' | 'square' | 'rectangle' | 'triangle'
  | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon'
  | 'rhombus' | 'parallelogram' | 'trapezoid' | 'kite'
  | 'line-horizontal' | 'line-vertical' | 'line-diagonal'
  | 'star' | 'cross' | 'arrow' | 'doughnut' | 'cloud' | 'heart' | 'crescent'
  | 'polygon' | 'custom'

export interface ShapeConfig {
  shape_type: TextLabsShapeType | null   // null when custom
  prompt: string | null                  // used when custom shape
  sides: number | null                   // 3-12, only for polygon
  fill_color: string
  stroke_color: string
  stroke_width: number                   // 0-10
  opacity: number                        // 0-1
  rotation: number                       // 0-359 degrees
  size: 'small' | 'medium' | 'large'
  target_background?: string | null
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

export interface InfographicV2Segment {
  label: string
  sublabel?: string
  description?: string
  icon_hint?: string
  color?: string
  connector_side?: 'left' | 'right' | 'top' | 'bottom' | null
}

export type InfographicSegmentCount = 'auto' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'

export interface InfographicConfig {
  mode: 'v1' | 'v2'
  aspect_ratio: 'auto' | '16:9' | '4:3' | '1:1' | '3:2' | '9:16'
  segments: InfographicSegmentCount | InfographicV2Segment[]
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
  layout_family?: 'horizontal_top' | 'horizontal_center' | 'vertical_left' | 'vertical_center' | null
  template_id?: string | null
  segment_colors?: string[]
  text_mode?: 'none' | 'heading' | 'heading_sublabel'
  show_icons?: boolean
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
  z_index?: number
  presentationId?: string | null
  useDeckTheme?: boolean
  themeOverrides?: ThemePalette | null
  themeVariantId?: string | null
  themeBindings?: Record<string, string> | null
  slideIndex?: number
  positionConfig?: TextLabsPositionConfig
  paddingConfig?: TextLabsPaddingConfig
  refine?: boolean
  existingElement?: Record<string, unknown> | null
  slideContext?: Record<string, unknown> | null
  deckContext?: Record<string, unknown> | null
  generationContext?: ElementGenerationContext | null
  research?: ElementResearchPolicy | null
  replaceElementId?: string | null
  slotName?: string | null
  slotKind?: TextSlotKind | null
  accessoryType?: string | null
  slotMetadata?: TextSlotMetadata
  generationConfig?: Record<string, unknown> | null
}

export interface TextBoxFormData extends TextLabsBaseFormData {
  componentType: 'TEXT_BOX'
  itemsPerInstance?: number
  textboxConfig: Partial<TextBoxConfig>
  structure?: TextBoxStructure
  semanticRole: TextSemanticRole
  geometryMode: TextGeometryMode
  manualGeometryOverrides?: TextManualGeometryOverrides
  compose?: boolean
  multiBoxColorMode?: 'SAME' | 'ALTERNATING' | 'PRIMARY_ACCENTS' | 'THEME_SEQUENCE'
  elements?: Array<{
    grid_position: {
      start_col: number
      start_row: number
      position_width: number
      position_height: number
    }
    theme_variant_id?: string | null
    theme_bindings?: Record<string, string> | null
  }>
}

export interface MetricsFormData extends TextLabsBaseFormData {
  componentType: 'METRICS'
  metricsConfig: Partial<MetricsConfig>
  multiBoxColorMode?: 'SAME' | 'ALTERNATING' | 'PRIMARY_ACCENTS' | 'THEME_SEQUENCE'
  /** Panel-only intent used to re-resolve against preflight live geometry. */
  metricsLayoutChoice?: 'auto' | 'horizontal' | 'vertical' | 'grid'
  metricsFitMode: MetricsFitMode
  manualMetricsOverrides?: MetricsManualOverrides
  compose?: boolean
  elements?: TextBoxFormData['elements']
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
  theme_variant_id?: string | null
  theme_bindings?: Record<string, string> | null
  research_provenance?: Record<string, unknown> | null
  semantic_role?: TextSemanticRole | null
  slot_name?: string | null
  slot_kind?: TextSlotKind | null
  accessory_type?: string | null
  resolved_geometry?: Record<string, unknown> | null
  platinum_profile?: Record<string, unknown> | string | null
  resolved_metrics_profile?: Record<string, unknown> | null
  metrics_color_variant?: string | null
  resolved_table_profile?: Record<string, unknown> | null
  citations_used?: Array<Record<string, unknown>> | null
  generation_config?: Record<string, unknown> | null
  generationConfig?: Record<string, unknown> | null
  metadata?: {
    theme_variant_id?: string | null
    theme_bindings?: Record<string, string> | null
    research_provenance?: Record<string, unknown> | null
    semantic_role?: TextSemanticRole | null
    slot_name?: string | null
    slot_kind?: TextSlotKind | null
    accessory_type?: string | null
    resolved_geometry?: Record<string, unknown> | null
    platinum_profile?: Record<string, unknown> | string | null
    resolved_metrics_profile?: Record<string, unknown> | null
    metrics_color_variant?: string | null
    resolved_table_profile?: Record<string, unknown> | null
    citations_used?: Array<Record<string, unknown>> | null
    generation_config?: Record<string, unknown> | null
    generationConfig?: Record<string, unknown> | null
    [key: string]: unknown
  } | null
}

export interface TextLabsResponse {
  success?: boolean
  element?: TextLabsElement
  elements?: TextLabsElement[]
  error?: string
  error_code?: string
  retryable?: boolean
  warnings?: string[]
  message?: string
  response_text?: string
  citations_used?: Array<Record<string, unknown>> | null
  resolved_geometry?: Record<string, unknown> | null
  platinum_profile?: Record<string, unknown> | string | null
  resolved_metrics_profile?: Record<string, unknown> | null
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
  TEXT_BOX: { width: 10, height: 6, zIndex: 1000 },
  METRICS: { width: 8, height: 5, zIndex: 1000 },
  TABLE: { width: 16, height: 8, zIndex: 1000 },
  CHART: { width: 16, height: 12, zIndex: 1000 },
  IMAGE: { width: 12, height: 7, zIndex: 1000 },
  ICON_LABEL: { width: 2, height: 2, zIndex: 1000 },
  SHAPE: { width: 3, height: 3, zIndex: 1000 },
  INFOGRAPHIC: { width: 16, height: 9, zIndex: 1000 },
  DIAGRAM: { width: 30, height: 14, zIndex: 1000 },
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
