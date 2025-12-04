// Element type definitions for format panels
// Aligned with ELEMENTOR_FRONTEND_INTEGRATION_SPEC.md (Backend v1.0.0)

export type ElementType = 'image' | 'table' | 'chart' | 'infographic' | 'diagram' | 'text' | 'hero'

// ============================================================================
// CHART / ANALYTICS TYPES (18 total)
// ============================================================================

// Standard Charts (Chart.js - 14 types)
export type StandardChartType =
  | 'line'
  | 'bar_vertical'
  | 'bar_horizontal'
  | 'pie'
  | 'doughnut'
  | 'scatter'
  | 'bubble'
  | 'radar'
  | 'polar_area'
  | 'area'
  | 'area_stacked'
  | 'bar_grouped'
  | 'bar_stacked'
  | 'waterfall'

// Advanced Charts (D3.js - 4 types)
export type D3ChartType =
  | 'd3_treemap'
  | 'd3_sunburst'
  | 'd3_choropleth_usa'
  | 'd3_sankey'

// All chart types
export type ChartType = StandardChartType | D3ChartType

// Chart themes (from backend spec)
export type ChartTheme =
  | 'professional'
  | 'corporate'
  | 'vibrant'
  | 'executive'
  | 'educational'
  | 'children_young'
  | 'children_older'

// Data format
export type ChartDataFormat = 'number' | 'currency' | 'percentage'

// Chart color palettes (kept for backward compatibility)
export type ChartPalette =
  | 'default'
  | 'professional'
  | 'vibrant'
  | 'pastel'
  | 'monochrome'

// ============================================================================
// DIAGRAM TYPES (34 total)
// ============================================================================

// Template Diagrams (19 types - Fastest)
export type TemplateDiagramType =
  // Cycle
  | 'cycle_3_step'
  | 'cycle_4_step'
  | 'cycle_5_step'
  // Pyramid
  | 'pyramid_3_level'
  | 'pyramid_4_level'
  | 'pyramid_5_level'
  // Venn
  | 'venn_2_circle'
  | 'venn_3_circle'
  // Honeycomb
  | 'honeycomb_3'
  | 'honeycomb_5'
  | 'honeycomb_7'
  // Hub & Spoke
  | 'hub_spoke_4'
  | 'hub_spoke_6'
  | 'hub_spoke_8'
  // Matrix
  | 'matrix_2x2'
  | 'matrix_3x3'
  | 'swot'
  | 'quadrant'
  // Funnel
  | 'funnel_3_stage'
  | 'funnel_4_stage'
  | 'funnel_5_stage'
  // Timeline
  | 'timeline_horizontal'
  // Process
  | 'process_flow_3'
  | 'process_flow_5'

// Mermaid Diagrams (7 types - AI-Generated)
export type MermaidDiagramType =
  | 'flowchart'
  | 'sequence'
  | 'gantt'
  | 'state'
  | 'erDiagram'
  | 'journey'
  | 'quadrantChart'

// Python Charts (8 types) - Only including network/sankey, others overlap with Analytics
export type PythonDiagramType =
  | 'network'
  | 'sankey'

// "Coming Soon" types (not supported by backend yet)
export type ComingSoonDiagramType =
  | 'class'
  | 'gitgraph'
  | 'mindmap'

// All diagram types
export type DiagramType = TemplateDiagramType | MermaidDiagramType | PythonDiagramType | ComingSoonDiagramType

// Diagram style
export type DiagramStyle = 'professional' | 'playful' | 'minimal' | 'bold'

// Mermaid diagram direction
export type DiagramDirection = 'TB' | 'BT' | 'LR' | 'RL'

// Mermaid theme (kept for backward compatibility)
export type DiagramTheme = 'default' | 'forest' | 'dark' | 'neutral'

// ============================================================================
// INFOGRAPHIC TYPES (14 total)
// ============================================================================

// Template-based (6 types - HTML Output)
export type TemplateInfographicType =
  | 'pyramid'
  | 'funnel'
  | 'concentric_circles'
  | 'concept_spread'
  | 'venn'
  | 'comparison'

// Dynamic SVG (8 types - AI-Generated)
export type DynamicInfographicType =
  | 'timeline'
  | 'process'
  | 'statistics'
  | 'hierarchy'
  | 'list'
  | 'cycle'
  | 'matrix'
  | 'roadmap'

// All infographic types
export type InfographicType = TemplateInfographicType | DynamicInfographicType

// Infographic color scheme
export type InfographicColorScheme =
  | 'professional'
  | 'vibrant'
  | 'pastel'
  | 'monochrome'
  | 'brand'

// Infographic icon style
export type InfographicIconStyle = 'emoji' | 'outlined' | 'filled' | 'none'

// ============================================================================
// IMAGE TYPES
// ============================================================================

// Image style presets (5 types)
export type ImageStyle =
  | 'realistic'
  | 'illustration'
  | 'abstract'
  | 'minimal'
  | 'photo'  // Renamed from 'photographic'

// Aspect ratio presets (5 native ratios)
export type AspectRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | 'custom'

// Image quality
export type ImageQuality = 'standard' | 'high'

// ============================================================================
// TEXT TYPES
// ============================================================================

// Text formats (6 types)
export type TextFormat =
  | 'paragraph'
  | 'bullets'
  | 'numbered'
  | 'headline'
  | 'quote'
  | 'mixed'

// Text tones (6 types)
export type TextTone =
  | 'professional'
  | 'conversational'
  | 'academic'
  | 'persuasive'
  | 'casual'
  | 'technical'

// Bullet styles (6 types)
export type BulletStyle = 'disc' | 'circle' | 'square' | 'dash' | 'arrow' | 'check'

// Text transformations (10 types)
export type TextTransformation =
  | 'expand'
  | 'condense'
  | 'simplify'
  | 'formalize'
  | 'casualize'
  | 'bulletize'
  | 'paragraphize'
  | 'rephrase'
  | 'proofread'
  | 'translate'

// ============================================================================
// TABLE TYPES
// ============================================================================

// Table styles (6 types)
export type TableStyle =
  | 'minimal'
  | 'bordered'
  | 'striped'
  | 'modern'
  | 'professional'
  | 'colorful'

// ============================================================================
// HERO SLIDE TYPES
// ============================================================================

// Hero types (6 types)
export type HeroType =
  | 'title'
  | 'title_with_image'
  | 'section'
  | 'section_with_image'
  | 'closing'
  | 'closing_with_image'

// Hero visual styles (for image variants)
export type HeroVisualStyle = 'illustrated' | 'professional' | 'kids'

// ============================================================================
// ELEMENT PROPERTIES
// ============================================================================

// Base properties shared by all elements
export interface BaseElementProperties {
  elementId: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number
  locked: boolean
  zIndex: number
  flipped?: { horizontal: boolean; vertical: boolean }
}

// Image-specific properties
export interface ImageElementProperties extends BaseElementProperties {
  type: 'image'
  src?: string
  style?: ImageStyle
  aspectRatio?: AspectRatio
  quality?: ImageQuality
  removeBackground?: boolean
  negativePrompt?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none'
  filters?: {
    brightness?: number
    contrast?: number
    saturation?: number
    blur?: number
    grayscale?: number
    sepia?: number
    hueRotate?: number
  }
}

// Table-specific properties
export interface TableElementProperties extends BaseElementProperties {
  type: 'table'
  rows: number
  cols: number
  hasHeaderRow: boolean
  tableStyle?: TableStyle
  data?: string[][]
  headerStyle?: {
    backgroundColor?: string
    textColor?: string
    fontWeight?: string
  }
}

// Chart-specific properties
export interface ChartElementProperties extends BaseElementProperties {
  type: 'chart'
  chartType: ChartType
  chartTheme?: ChartTheme
  dataFormat?: ChartDataFormat
  useSynthetic?: boolean
  colorPalette?: ChartPalette
  customColors?: string[]
  data?: {
    labels: string[]
    datasets: Array<{
      label?: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string
    }>
  }
  options?: {
    title?: { display: boolean; text?: string }
    legend?: { display: boolean; position?: 'top' | 'bottom' | 'left' | 'right' }
    grid?: { display: boolean }
  }
}

// Infographic-specific properties
export interface InfographicElementProperties extends BaseElementProperties {
  type: 'infographic'
  infographicType: InfographicType
  itemCount?: number
  colorScheme?: InfographicColorScheme
  iconStyle?: InfographicIconStyle
  includeDescriptions?: boolean
  content?: string
  items?: Array<{
    title?: string
    description?: string
    value?: string | number
    icon?: string
  }>
  style?: {
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
  }
}

// Diagram (Mermaid) specific properties
export interface DiagramElementProperties extends BaseElementProperties {
  type: 'diagram'
  diagramType: DiagramType
  diagramStyle?: DiagramStyle
  primaryColor?: string
  direction?: DiagramDirection
  theme?: DiagramTheme
  mermaidDefinition?: string
}

// Text-specific properties
export interface TextElementProperties extends BaseElementProperties {
  type: 'text'
  textFormat?: TextFormat
  tone?: TextTone
  bulletStyle?: BulletStyle
  includeEmoji?: boolean
  content?: string
}

// Hero-specific properties
export interface HeroElementProperties extends BaseElementProperties {
  type: 'hero'
  heroType: HeroType
  visualStyle?: HeroVisualStyle
  title?: string
  subtitle?: string
  contactInfo?: string
}

// Union type for all element properties
export type ElementProperties =
  | ImageElementProperties
  | TableElementProperties
  | ChartElementProperties
  | InfographicElementProperties
  | DiagramElementProperties
  | TextElementProperties
  | HeroElementProperties

// Type guard functions
export function isImageElement(props: ElementProperties): props is ImageElementProperties {
  return props.type === 'image'
}

export function isTableElement(props: ElementProperties): props is TableElementProperties {
  return props.type === 'table'
}

export function isChartElement(props: ElementProperties): props is ChartElementProperties {
  return props.type === 'chart'
}

export function isInfographicElement(props: ElementProperties): props is InfographicElementProperties {
  return props.type === 'infographic'
}

export function isDiagramElement(props: ElementProperties): props is DiagramElementProperties {
  return props.type === 'diagram'
}

export function isTextElement(props: ElementProperties): props is TextElementProperties {
  return props.type === 'text'
}

export function isHeroElement(props: ElementProperties): props is HeroElementProperties {
  return props.type === 'hero'
}

// Element display info for UI
export const ELEMENT_INFO: Record<ElementType, { icon: string; label: string; color: string }> = {
  image: { icon: 'Image', label: 'Image', color: '#10b981' },
  table: { icon: 'Table', label: 'Table', color: '#3b82f6' },
  chart: { icon: 'BarChart3', label: 'Chart', color: '#f59e0b' },
  infographic: { icon: 'LayoutGrid', label: 'Infographic', color: '#8b5cf6' },
  diagram: { icon: 'GitBranch', label: 'Diagram', color: '#ec4899' },
  text: { icon: 'Type', label: 'Text', color: '#6366f1' },
  hero: { icon: 'Layout', label: 'Hero Slide', color: '#14b8a6' },
}

// ============================================================================
// UI OPTION ARRAYS
// ============================================================================

// Chart type labels for UI (18 types, grouped)
export const CHART_TYPES: { type: ChartType; label: string; group: 'standard' | 'd3' }[] = [
  // Standard Charts
  { type: 'line', label: 'Line', group: 'standard' },
  { type: 'bar_vertical', label: 'Vertical Bar', group: 'standard' },
  { type: 'bar_horizontal', label: 'Horizontal Bar', group: 'standard' },
  { type: 'pie', label: 'Pie', group: 'standard' },
  { type: 'doughnut', label: 'Doughnut', group: 'standard' },
  { type: 'scatter', label: 'Scatter', group: 'standard' },
  { type: 'bubble', label: 'Bubble', group: 'standard' },
  { type: 'radar', label: 'Radar', group: 'standard' },
  { type: 'polar_area', label: 'Polar Area', group: 'standard' },
  { type: 'area', label: 'Area', group: 'standard' },
  { type: 'area_stacked', label: 'Stacked Area', group: 'standard' },
  { type: 'bar_grouped', label: 'Grouped Bar', group: 'standard' },
  { type: 'bar_stacked', label: 'Stacked Bar', group: 'standard' },
  { type: 'waterfall', label: 'Waterfall', group: 'standard' },
  // D3 Charts
  { type: 'd3_treemap', label: 'Treemap', group: 'd3' },
  { type: 'd3_sunburst', label: 'Sunburst', group: 'd3' },
  { type: 'd3_choropleth_usa', label: 'US Map', group: 'd3' },
  { type: 'd3_sankey', label: 'Sankey', group: 'd3' },
]

// Chart themes for UI
export const CHART_THEMES: { theme: ChartTheme; label: string }[] = [
  { theme: 'professional', label: 'Professional' },
  { theme: 'corporate', label: 'Corporate' },
  { theme: 'vibrant', label: 'Vibrant' },
  { theme: 'executive', label: 'Executive' },
  { theme: 'educational', label: 'Educational' },
  { theme: 'children_young', label: 'Kids (Young)' },
  { theme: 'children_older', label: 'Kids (Older)' },
]

// Chart data formats for UI
export const CHART_DATA_FORMATS: { format: ChartDataFormat; label: string; symbol: string }[] = [
  { format: 'number', label: 'Number', symbol: '#' },
  { format: 'currency', label: 'Currency', symbol: '$' },
  { format: 'percentage', label: 'Percentage', symbol: '%' },
]

// Diagram types for UI (34 types, grouped with coming soon flags)
export const DIAGRAM_TYPES: { type: DiagramType; label: string; group: string; comingSoon?: boolean }[] = [
  // Cycle Diagrams
  { type: 'cycle_3_step', label: '3-Step Cycle', group: 'Cycle' },
  { type: 'cycle_4_step', label: '4-Step Cycle', group: 'Cycle' },
  { type: 'cycle_5_step', label: '5-Step Cycle', group: 'Cycle' },
  // Pyramid
  { type: 'pyramid_3_level', label: '3-Level Pyramid', group: 'Pyramid' },
  { type: 'pyramid_4_level', label: '4-Level Pyramid', group: 'Pyramid' },
  { type: 'pyramid_5_level', label: '5-Level Pyramid', group: 'Pyramid' },
  // Venn
  { type: 'venn_2_circle', label: '2-Circle Venn', group: 'Venn' },
  { type: 'venn_3_circle', label: '3-Circle Venn', group: 'Venn' },
  // Matrix
  { type: 'matrix_2x2', label: '2×2 Matrix', group: 'Matrix' },
  { type: 'matrix_3x3', label: '3×3 Matrix', group: 'Matrix' },
  { type: 'swot', label: 'SWOT Analysis', group: 'Matrix' },
  { type: 'quadrant', label: 'Quadrant', group: 'Matrix' },
  // Funnel
  { type: 'funnel_3_stage', label: '3-Stage Funnel', group: 'Funnel' },
  { type: 'funnel_4_stage', label: '4-Stage Funnel', group: 'Funnel' },
  { type: 'funnel_5_stage', label: '5-Stage Funnel', group: 'Funnel' },
  // Process Flow
  { type: 'process_flow_3', label: '3-Step Process', group: 'Process' },
  { type: 'process_flow_5', label: '5-Step Process', group: 'Process' },
  { type: 'flowchart', label: 'Flowchart', group: 'Process' },
  // Hub & Spoke
  { type: 'hub_spoke_4', label: '4-Spoke Hub', group: 'Hub & Spoke' },
  { type: 'hub_spoke_6', label: '6-Spoke Hub', group: 'Hub & Spoke' },
  { type: 'hub_spoke_8', label: '8-Spoke Hub', group: 'Hub & Spoke' },
  // Honeycomb
  { type: 'honeycomb_3', label: '3-Cell Honeycomb', group: 'Honeycomb' },
  { type: 'honeycomb_5', label: '5-Cell Honeycomb', group: 'Honeycomb' },
  { type: 'honeycomb_7', label: '7-Cell Honeycomb', group: 'Honeycomb' },
  // Timeline
  { type: 'timeline_horizontal', label: 'Timeline', group: 'Timeline' },
  { type: 'gantt', label: 'Gantt Chart', group: 'Timeline' },
  // Relationships
  { type: 'sequence', label: 'Sequence Diagram', group: 'Relationships' },
  { type: 'network', label: 'Network Diagram', group: 'Relationships' },
  { type: 'sankey', label: 'Sankey Diagram', group: 'Relationships' },
  // Mermaid
  { type: 'state', label: 'State Diagram', group: 'Mermaid' },
  { type: 'erDiagram', label: 'ER Diagram', group: 'Mermaid' },
  { type: 'journey', label: 'User Journey', group: 'Mermaid' },
  { type: 'quadrantChart', label: 'Quadrant Chart', group: 'Mermaid' },
  // Coming Soon
  { type: 'class', label: 'Class Diagram', group: 'Coming Soon', comingSoon: true },
  { type: 'gitgraph', label: 'Git Graph', group: 'Coming Soon', comingSoon: true },
  { type: 'mindmap', label: 'Mindmap', group: 'Coming Soon', comingSoon: true },
]

// Diagram styles for UI
export const DIAGRAM_STYLES: { style: DiagramStyle; label: string }[] = [
  { style: 'professional', label: 'Professional' },
  { style: 'playful', label: 'Playful' },
  { style: 'minimal', label: 'Minimal' },
  { style: 'bold', label: 'Bold' },
]

// Infographic types for UI (14 types, grouped)
export const INFOGRAPHIC_TYPES: { type: InfographicType; label: string; group: string; description: string }[] = [
  // Hierarchical
  { type: 'pyramid', label: 'Pyramid', group: 'Hierarchical', description: '3-6 levels' },
  { type: 'hierarchy', label: 'Org Chart / Tree', group: 'Hierarchical', description: 'Organization structure' },
  // Sequential
  { type: 'funnel', label: 'Funnel', group: 'Sequential', description: '3-5 stages' },
  { type: 'timeline', label: 'Timeline', group: 'Sequential', description: 'Milestones' },
  { type: 'process', label: 'Process Flow', group: 'Sequential', description: 'Step-by-step' },
  { type: 'roadmap', label: 'Roadmap', group: 'Sequential', description: 'Project phases' },
  // Comparative
  { type: 'comparison', label: 'Comparison', group: 'Comparative', description: 'Side-by-side' },
  { type: 'venn', label: 'Venn Diagram', group: 'Comparative', description: '2-4 circles' },
  { type: 'matrix', label: 'Matrix Grid', group: 'Comparative', description: 'Grid comparison' },
  // Conceptual
  { type: 'concentric_circles', label: 'Concentric Circles', group: 'Conceptual', description: '3-5 rings' },
  { type: 'concept_spread', label: 'Hexagon Spread', group: 'Conceptual', description: '6 hexagons' },
  { type: 'cycle', label: 'Cycle Diagram', group: 'Conceptual', description: 'Circular process' },
  // Data
  { type: 'statistics', label: 'Statistics/KPIs', group: 'Data', description: 'Numbers & metrics' },
  { type: 'list', label: 'Visual List', group: 'Data', description: 'Numbered or icon list' },
]

// Infographic color schemes for UI
export const INFOGRAPHIC_COLOR_SCHEMES: { scheme: InfographicColorScheme; label: string }[] = [
  { scheme: 'professional', label: 'Professional' },
  { scheme: 'vibrant', label: 'Vibrant' },
  { scheme: 'pastel', label: 'Pastel' },
  { scheme: 'monochrome', label: 'Monochrome' },
  { scheme: 'brand', label: 'Brand Colors' },
]

// Infographic icon styles for UI
export const INFOGRAPHIC_ICON_STYLES: { style: InfographicIconStyle; label: string }[] = [
  { style: 'emoji', label: 'Emoji' },
  { style: 'outlined', label: 'Outlined' },
  { style: 'filled', label: 'Filled' },
  { style: 'none', label: 'None' },
]

// Image style labels for UI
export const IMAGE_STYLES: { style: ImageStyle; label: string }[] = [
  { style: 'realistic', label: 'Realistic' },
  { style: 'illustration', label: 'Illustration' },
  { style: 'abstract', label: 'Abstract' },
  { style: 'minimal', label: 'Minimal' },
  { style: 'photo', label: 'Photo' },
]

// Aspect ratio labels for UI (5 native ratios)
export const ASPECT_RATIOS: { ratio: AspectRatio; label: string }[] = [
  { ratio: '16:9', label: '16:9' },
  { ratio: '4:3', label: '4:3' },
  { ratio: '1:1', label: '1:1' },
  { ratio: '3:4', label: '3:4' },
  { ratio: '9:16', label: '9:16' },
]

// Image quality options for UI
export const IMAGE_QUALITY_OPTIONS: { quality: ImageQuality; label: string }[] = [
  { quality: 'standard', label: 'Standard' },
  { quality: 'high', label: 'High' },
]

// Text formats for UI
export const TEXT_FORMATS: { format: TextFormat; label: string }[] = [
  { format: 'paragraph', label: 'Paragraph' },
  { format: 'bullets', label: 'Bullets' },
  { format: 'numbered', label: 'Numbered' },
  { format: 'headline', label: 'Headline' },
  { format: 'quote', label: 'Quote' },
  { format: 'mixed', label: 'Mixed' },
]

// Text tones for UI
export const TEXT_TONES: { tone: TextTone; label: string }[] = [
  { tone: 'professional', label: 'Professional' },
  { tone: 'conversational', label: 'Conversational' },
  { tone: 'academic', label: 'Academic' },
  { tone: 'persuasive', label: 'Persuasive' },
  { tone: 'casual', label: 'Casual' },
  { tone: 'technical', label: 'Technical' },
]

// Bullet styles for UI
export const BULLET_STYLES: { style: BulletStyle; label: string; symbol: string }[] = [
  { style: 'disc', label: 'Disc', symbol: '●' },
  { style: 'circle', label: 'Circle', symbol: '○' },
  { style: 'square', label: 'Square', symbol: '■' },
  { style: 'dash', label: 'Dash', symbol: '—' },
  { style: 'arrow', label: 'Arrow', symbol: '→' },
  { style: 'check', label: 'Check', symbol: '✓' },
]

// Table styles for UI
export const TABLE_STYLES: { style: TableStyle; label: string }[] = [
  { style: 'minimal', label: 'Minimal' },
  { style: 'bordered', label: 'Bordered' },
  { style: 'striped', label: 'Striped' },
  { style: 'modern', label: 'Modern' },
  { style: 'professional', label: 'Professional' },
  { style: 'colorful', label: 'Colorful' },
]

// Hero types for UI
export const HERO_TYPES: { type: HeroType; label: string; hasImage: boolean }[] = [
  { type: 'title', label: 'Title Slide', hasImage: false },
  { type: 'title_with_image', label: 'Title with Image', hasImage: true },
  { type: 'section', label: 'Section Divider', hasImage: false },
  { type: 'section_with_image', label: 'Section with Image', hasImage: true },
  { type: 'closing', label: 'Closing Slide', hasImage: false },
  { type: 'closing_with_image', label: 'Closing with Image', hasImage: true },
]

// Hero visual styles for UI
export const HERO_VISUAL_STYLES: { style: HeroVisualStyle; label: string }[] = [
  { style: 'illustrated', label: 'Illustrated' },
  { style: 'professional', label: 'Professional' },
  { style: 'kids', label: 'Playful / Kids' },
]

// Chart color palettes (kept for backward compatibility)
export const CHART_PALETTES: Record<ChartPalette, string[]> = {
  default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
  professional: ['#1e3a5f', '#3d5a80', '#98c1d9', '#e0fbfc', '#ee6c4d'],
  vibrant: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
  pastel: ['#a8d8ea', '#aa96da', '#fcbad3', '#ffffd2', '#b5ead7'],
  monochrome: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'],
}
