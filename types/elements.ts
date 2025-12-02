// Element type definitions for format panels

export type ElementType = 'image' | 'table' | 'chart' | 'infographic' | 'diagram'

// Infographic types (12 total)
export type InfographicType =
  | 'timeline'
  | 'process'
  | 'comparison'
  | 'statistics'
  | 'hierarchy'
  | 'list'
  | 'cycle'
  | 'pyramid'
  | 'matrix'
  | 'venn'
  | 'funnel'
  | 'roadmap'

// Mermaid diagram types (11 total)
export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'userjourney'
  | 'gitgraph'
  | 'mindmap'
  | 'pie'
  | 'timeline'

// Chart types
export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'doughnut'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'polarArea'

// Image style presets
export type ImageStyle =
  | 'realistic'
  | 'illustration'
  | 'abstract'
  | 'minimal'
  | 'photographic'

// Aspect ratio presets
export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | 'custom'

// Mermaid diagram direction
export type DiagramDirection = 'TB' | 'BT' | 'LR' | 'RL'

// Mermaid theme
export type DiagramTheme = 'default' | 'forest' | 'dark' | 'neutral'

// Chart color palettes
export type ChartPalette =
  | 'default'
  | 'professional'
  | 'vibrant'
  | 'pastel'
  | 'monochrome'

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
    iconStyle?: 'outline' | 'filled' | 'duotone'
  }
}

// Diagram (Mermaid) specific properties
export interface DiagramElementProperties extends BaseElementProperties {
  type: 'diagram'
  diagramType: DiagramType
  direction?: DiagramDirection
  theme?: DiagramTheme
  mermaidDefinition?: string
}

// Union type for all element properties
export type ElementProperties =
  | ImageElementProperties
  | TableElementProperties
  | ChartElementProperties
  | InfographicElementProperties
  | DiagramElementProperties

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

// Element display info for UI
export const ELEMENT_INFO: Record<ElementType, { icon: string; label: string; color: string }> = {
  image: { icon: 'Image', label: 'Image', color: '#10b981' },
  table: { icon: 'Table', label: 'Table', color: '#3b82f6' },
  chart: { icon: 'BarChart3', label: 'Chart', color: '#f59e0b' },
  infographic: { icon: 'LayoutGrid', label: 'Infographic', color: '#8b5cf6' },
  diagram: { icon: 'GitBranch', label: 'Diagram', color: '#ec4899' },
}

// Infographic type labels for UI
export const INFOGRAPHIC_TYPES: { type: InfographicType; label: string }[] = [
  { type: 'timeline', label: 'Timeline' },
  { type: 'process', label: 'Process' },
  { type: 'comparison', label: 'Comparison' },
  { type: 'statistics', label: 'Statistics' },
  { type: 'hierarchy', label: 'Hierarchy' },
  { type: 'list', label: 'List' },
  { type: 'cycle', label: 'Cycle' },
  { type: 'pyramid', label: 'Pyramid' },
  { type: 'matrix', label: 'Matrix' },
  { type: 'venn', label: 'Venn' },
  { type: 'funnel', label: 'Funnel' },
  { type: 'roadmap', label: 'Roadmap' },
]

// Diagram type labels for UI
export const DIAGRAM_TYPES: { type: DiagramType; label: string }[] = [
  { type: 'flowchart', label: 'Flowchart' },
  { type: 'sequence', label: 'Sequence' },
  { type: 'class', label: 'Class' },
  { type: 'state', label: 'State' },
  { type: 'er', label: 'ER' },
  { type: 'gantt', label: 'Gantt' },
  { type: 'mindmap', label: 'Mindmap' },
  { type: 'timeline', label: 'Timeline' },
  { type: 'userjourney', label: 'User Journey' },
  { type: 'gitgraph', label: 'Git Graph' },
]

// Chart type labels for UI
export const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'bar', label: 'Bar' },
  { type: 'line', label: 'Line' },
  { type: 'pie', label: 'Pie' },
  { type: 'doughnut', label: 'Doughnut' },
  { type: 'area', label: 'Area' },
  { type: 'scatter', label: 'Scatter' },
  { type: 'radar', label: 'Radar' },
]

// Image style labels for UI
export const IMAGE_STYLES: { style: ImageStyle; label: string }[] = [
  { style: 'realistic', label: 'Realistic' },
  { style: 'illustration', label: 'Illustration' },
  { style: 'abstract', label: 'Abstract' },
  { style: 'minimal', label: 'Minimal' },
  { style: 'photographic', label: 'Photo' },
]

// Aspect ratio labels for UI
export const ASPECT_RATIOS: { ratio: AspectRatio; label: string }[] = [
  { ratio: '16:9', label: '16:9' },
  { ratio: '4:3', label: '4:3' },
  { ratio: '1:1', label: '1:1' },
  { ratio: '9:16', label: '9:16' },
]

// Chart color palettes
export const CHART_PALETTES: Record<ChartPalette, string[]> = {
  default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
  professional: ['#1e3a5f', '#3d5a80', '#98c1d9', '#e0fbfc', '#ee6c4d'],
  vibrant: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
  pastel: ['#a8d8ea', '#aa96da', '#fcbad3', '#ffffd2', '#b5ead7'],
  monochrome: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'],
}
