# AI Service: Illustrator (Infographic)

This document specifies the Illustrator AI Service requirements for generating infographic elements within presentations. The service creates visual layouts that combine icons, shapes, text, and data visualizations into cohesive infographic designs.

---

## Service Overview

The Illustrator Service generates 12 types of infographics:

| Type | Description | Use Case |
|------|-------------|----------|
| `timeline` | Linear progression of events | History, roadmaps, milestones |
| `process` | Step-by-step workflow | Procedures, how-to guides |
| `comparison` | Side-by-side analysis | Product comparisons, pros/cons |
| `statistics` | Numbers & percentages | KPIs, metrics, achievements |
| `hierarchy` | Org chart or tree structure | Organizations, taxonomies |
| `list` | Numbered or icon list | Features, benefits, steps |
| `cycle` | Circular process | Recurring workflows, ecosystems |
| `pyramid` | Layered hierarchy | Priority levels, foundations |
| `matrix` | Grid comparison | Feature matrices, quadrants |
| `venn` | Overlapping concepts | Relationships, intersections |
| `funnel` | Narrowing stages | Sales funnels, conversion paths |
| `roadmap` | Project timeline | Product roadmaps, planning |

---

## Service Endpoints

### Base URL
```
POST /api/ai/illustrator/*
```

---

## Infographic Generation

### 1. Generate Infographic

```
POST /api/ai/illustrator/generate
```

#### Request Schema

```typescript
interface InfographicGenerateRequest {
  // Required
  prompt: string                    // Description of infographic content
  type: InfographicType             // One of 12 types
  presentationId: string
  slideId: string
  elementId: string

  // Context
  context: {
    presentationTitle: string
    presentationTheme?: string
    slideTitle?: string
    slideIndex: number
    brandColors?: string[]          // Brand color palette
  }

  // Element constraints
  constraints: {
    gridWidth: number               // Element width in grid units (1-12)
    gridHeight: number              // Element height in grid units (1-8)
  }

  // Style options
  style?: {
    colorScheme: InfographicColorScheme
    iconStyle: IconStyle
    density: 'compact' | 'balanced' | 'spacious'
    orientation?: 'horizontal' | 'vertical' | 'auto'
  }

  // Content options
  contentOptions?: {
    itemCount?: number              // Number of items (type-dependent)
    includeIcons?: boolean          // Add icons to items
    includeDescriptions?: boolean   // Add description text
    includeNumbers?: boolean        // Add numbering
    maxTextLength?: number          // Per-item text limit
  }
}

type InfographicType =
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

type InfographicColorScheme =
  | 'brand'           // Use brand colors from context
  | 'professional'    // Blues and grays
  | 'vibrant'         // Bold, saturated colors
  | 'pastel'          // Soft, muted colors
  | 'monochrome'      // Single color variations
  | 'gradient'        // Gradient transitions
  | 'custom'          // Custom colors provided

type IconStyle =
  | 'outlined'        // Line icons
  | 'filled'          // Solid icons
  | 'duotone'         // Two-tone icons
  | 'minimal'         // Simple geometric
  | 'illustrated'     // Detailed illustrations
  | 'emoji'           // Emoji-based
```

#### Response Schema

```typescript
interface InfographicGenerateResponse {
  success: boolean
  data?: {
    generationId: string

    // Rendered output (primary)
    rendered: {
      svg: string                   // Complete SVG content
      html: string                  // HTML alternative
      png?: string                  // Base64 PNG (optional)
    }

    // Structured data
    infographicData: InfographicData

    // Metadata
    metadata: {
      type: InfographicType
      itemCount: number
      dimensions: {
        width: number               // Actual pixel width
        height: number              // Actual pixel height
        aspectRatio: number
      }
      colorPalette: string[]        // Colors used
      iconsUsed: string[]           // Icon identifiers
    }

    // Edit capabilities
    editInfo: {
      editableItems: boolean        // Can edit individual items
      reorderableItems: boolean     // Can reorder items
      addableItems: boolean         // Can add more items
      maxItems: number              // Maximum items for type
    }
  }
  error?: {
    code: IllustratorErrorCode
    message: string
    retryable: boolean
  }
}

type IllustratorErrorCode =
  | 'INVALID_TYPE'
  | 'INVALID_PROMPT'
  | 'GENERATION_FAILED'
  | 'CONTENT_FILTERED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
```

---

## Infographic Data Structures

### Base Structure

```typescript
interface InfographicData {
  type: InfographicType
  title?: string
  subtitle?: string
  items: InfographicItem[]
  style: InfographicStyle
}

interface InfographicItem {
  id: string
  title: string
  description?: string
  icon?: IconReference
  value?: string | number
  percentage?: number
  color?: string
  position?: number                 // Order/position in layout
  children?: InfographicItem[]      // For hierarchical types
  connections?: string[]            // IDs of connected items
}

interface IconReference {
  library: 'lucide' | 'heroicons' | 'phosphor' | 'custom'
  name: string
  color?: string
}

interface InfographicStyle {
  colorScheme: InfographicColorScheme
  primaryColor: string
  secondaryColors: string[]
  backgroundColor: string
  textColor: string
  iconStyle: IconStyle
  fontFamily: string
  spacing: 'compact' | 'balanced' | 'spacious'
}
```

### Type-Specific Data

#### Timeline

```typescript
interface TimelineData extends InfographicData {
  type: 'timeline'
  items: TimelineItem[]
  orientation: 'horizontal' | 'vertical'
  connectorStyle: 'line' | 'arrow' | 'dotted'
}

interface TimelineItem extends InfographicItem {
  date?: string
  dateLabel?: string
  milestone?: boolean
  status?: 'past' | 'current' | 'future'
}
```

#### Process

```typescript
interface ProcessData extends InfographicData {
  type: 'process'
  items: ProcessStep[]
  layout: 'linear' | 'zigzag' | 'circular'
  showNumbers: boolean
  showArrows: boolean
}

interface ProcessStep extends InfographicItem {
  stepNumber: number
  duration?: string
  responsible?: string
}
```

#### Comparison

```typescript
interface ComparisonData extends InfographicData {
  type: 'comparison'
  items: ComparisonColumn[]
  layout: 'side-by-side' | 'table' | 'cards'
  highlightWinner?: boolean
}

interface ComparisonColumn extends InfographicItem {
  features: ComparisonFeature[]
  winner?: boolean
  badge?: string                    // "Best Value", "Popular", etc.
}

interface ComparisonFeature {
  name: string
  value: string | number | boolean
  highlight?: boolean
}
```

#### Statistics

```typescript
interface StatisticsData extends InfographicData {
  type: 'statistics'
  items: StatItem[]
  layout: 'grid' | 'row' | 'featured'
}

interface StatItem extends InfographicItem {
  value: number
  unit?: string
  prefix?: string                   // "$", "+"
  suffix?: string                   // "%", "k"
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string               // "+15%"
}
```

#### Hierarchy

```typescript
interface HierarchyData extends InfographicData {
  type: 'hierarchy'
  items: HierarchyNode[]
  layout: 'tree' | 'org-chart' | 'radial'
  direction: 'top-down' | 'left-right'
}

interface HierarchyNode extends InfographicItem {
  level: number
  parent?: string                   // Parent ID
  children: HierarchyNode[]
  collapsed?: boolean
  avatar?: string                   // For org charts
  role?: string                     // For org charts
}
```

#### Cycle

```typescript
interface CycleData extends InfographicData {
  type: 'cycle'
  items: CycleStep[]
  centerContent?: {
    title: string
    icon?: IconReference
  }
  rotationDirection: 'clockwise' | 'counterclockwise'
}

interface CycleStep extends InfographicItem {
  order: number
  duration?: string
  percentage?: number               // Size of arc
}
```

#### Pyramid

```typescript
interface PyramidData extends InfographicData {
  type: 'pyramid'
  items: PyramidLevel[]
  orientation: 'up' | 'down'        // Point up or down
  showPercentages: boolean
}

interface PyramidLevel extends InfographicItem {
  level: number                     // 0 = top/smallest
  width: number                     // Relative width (0-100)
  percentage?: number
}
```

#### Matrix

```typescript
interface MatrixData extends InfographicData {
  type: 'matrix'
  rows: MatrixAxis[]
  columns: MatrixAxis[]
  cells: MatrixCell[][]
  showLabels: boolean
}

interface MatrixAxis {
  id: string
  label: string
  description?: string
}

interface MatrixCell extends InfographicItem {
  row: number
  column: number
  value?: number                    // For heatmaps
  items?: string[]                  // List of items in cell
}
```

#### Venn

```typescript
interface VennData extends InfographicData {
  type: 'venn'
  sets: VennSet[]
  intersections: VennIntersection[]
  layout: '2-circle' | '3-circle' | '4-circle'
}

interface VennSet extends InfographicItem {
  items: string[]
  size?: number                     // Relative size
}

interface VennIntersection {
  sets: string[]                    // IDs of overlapping sets
  label: string
  items?: string[]
  color?: string
}
```

#### Funnel

```typescript
interface FunnelData extends InfographicData {
  type: 'funnel'
  items: FunnelStage[]
  showConversionRates: boolean
  orientation: 'vertical' | 'horizontal'
}

interface FunnelStage extends InfographicItem {
  value: number
  percentage: number                // Of total or previous
  conversionRate?: number           // Drop from previous stage
  width: number                     // Relative width (0-100)
}
```

#### Roadmap

```typescript
interface RoadmapData extends InfographicData {
  type: 'roadmap'
  items: RoadmapPhase[]
  timeScale: 'days' | 'weeks' | 'months' | 'quarters' | 'years'
  showMilestones: boolean
  currentPosition?: string          // Current date marker
}

interface RoadmapPhase extends InfographicItem {
  startDate: string
  endDate: string
  status: 'completed' | 'in-progress' | 'planned'
  milestones: RoadmapMilestone[]
  progress?: number                 // 0-100
}

interface RoadmapMilestone {
  date: string
  title: string
  completed: boolean
}
```

---

## Content Generation Guidelines

### Item Count by Type

```typescript
const ITEM_LIMITS = {
  timeline: { min: 3, max: 10, default: 5 },
  process: { min: 3, max: 8, default: 5 },
  comparison: { min: 2, max: 4, default: 2 },
  statistics: { min: 2, max: 8, default: 4 },
  hierarchy: { min: 3, max: 20, default: 7 },
  list: { min: 3, max: 10, default: 5 },
  cycle: { min: 3, max: 8, default: 5 },
  pyramid: { min: 3, max: 6, default: 4 },
  matrix: { min: 4, max: 16, default: 9 },  // rows × cols
  venn: { min: 2, max: 4, default: 3 },
  funnel: { min: 3, max: 7, default: 5 },
  roadmap: { min: 3, max: 8, default: 4 }
}
```

### Grid Size to Layout Mapping

```typescript
const LAYOUT_BY_SIZE = {
  // Small elements (≤4 grid units wide)
  small: {
    timeline: 'vertical',
    process: 'vertical',
    comparison: 'stacked',
    statistics: '2x2',
    hierarchy: 'compact',
    list: 'single-column',
    cycle: 'small-circle',
    pyramid: 'narrow',
    matrix: '2x2',
    venn: '2-circle',
    funnel: 'narrow',
    roadmap: 'vertical'
  },

  // Medium elements (5-8 grid units wide)
  medium: {
    timeline: 'horizontal',
    process: 'zigzag',
    comparison: 'side-by-side',
    statistics: '2x2',
    hierarchy: 'tree',
    list: 'two-column',
    cycle: 'medium-circle',
    pyramid: 'standard',
    matrix: '3x3',
    venn: '3-circle',
    funnel: 'standard',
    roadmap: 'horizontal'
  },

  // Large elements (9-12 grid units wide)
  large: {
    timeline: 'horizontal-expanded',
    process: 'horizontal',
    comparison: 'detailed',
    statistics: '4x2',
    hierarchy: 'org-chart',
    list: 'three-column',
    cycle: 'large-circle',
    pyramid: 'detailed',
    matrix: '4x4',
    venn: '3-circle-detailed',
    funnel: 'detailed',
    roadmap: 'gantt-style'
  }
}

function getLayoutSize(gridWidth: number): 'small' | 'medium' | 'large' {
  if (gridWidth <= 4) return 'small'
  if (gridWidth <= 8) return 'medium'
  return 'large'
}
```

---

## SVG Generation

### SVG Template Structure

```typescript
interface SVGTemplate {
  viewBox: string                   // "0 0 width height"
  width: number
  height: number

  // Layer structure
  layers: {
    background: SVGLayer
    shapes: SVGLayer
    connectors: SVGLayer
    icons: SVGLayer
    text: SVGLayer
    decorations: SVGLayer
  }

  // Definitions (gradients, patterns, filters)
  defs: string
}

interface SVGLayer {
  id: string
  elements: string[]                // SVG element strings
  transform?: string
}
```

### Icon Library Integration

```typescript
interface IconLibrary {
  name: string
  baseUrl: string
  format: 'svg' | 'font'

  // Get icon by category
  getIcon(category: IconCategory, name: string): Promise<string>

  // Search icons
  searchIcons(query: string, limit?: number): Promise<IconResult[]>
}

type IconCategory =
  | 'business'
  | 'technology'
  | 'finance'
  | 'education'
  | 'healthcare'
  | 'marketing'
  | 'general'
  | 'arrows'
  | 'charts'

// Recommended icon mapping by infographic type
const RECOMMENDED_ICONS: Record<InfographicType, IconCategory[]> = {
  timeline: ['general', 'arrows'],
  process: ['arrows', 'general'],
  comparison: ['charts', 'general'],
  statistics: ['charts', 'finance'],
  hierarchy: ['business', 'general'],
  list: ['general'],
  cycle: ['arrows', 'general'],
  pyramid: ['business', 'general'],
  matrix: ['charts', 'business'],
  venn: ['general'],
  funnel: ['marketing', 'arrows'],
  roadmap: ['general', 'business']
}
```

---

## Transform Operations

### 2. Update Infographic Item

```
POST /api/ai/illustrator/update-item
```

#### Request Schema

```typescript
interface UpdateItemRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  itemId: string
  updates: Partial<InfographicItem>
}
```

### 3. Regenerate Infographic

```
POST /api/ai/illustrator/regenerate
```

#### Request Schema

```typescript
interface RegenerateRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  // What to keep
  preserve: {
    type: boolean                   // Keep infographic type
    content: boolean                // Keep item text/data
    style: boolean                  // Keep visual style
  }

  // New instructions
  modifications?: string            // Additional AI guidance
}
```

### 4. Change Infographic Type

```
POST /api/ai/illustrator/change-type
```

#### Request Schema

```typescript
interface ChangeTypeRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  newType: InfographicType
  adaptContent: boolean             // Try to preserve content
}
```

---

## Style System

### Color Scheme Definitions

```typescript
const COLOR_SCHEMES: Record<InfographicColorScheme, ColorPalette> = {
  professional: {
    primary: '#1E40AF',
    secondary: ['#3B82F6', '#60A5FA', '#93C5FD'],
    accent: '#0D9488',
    background: '#F8FAFC',
    text: '#1E293B',
    muted: '#94A3B8'
  },
  vibrant: {
    primary: '#7C3AED',
    secondary: ['#A855F7', '#C084FC', '#E879F9'],
    accent: '#F59E0B',
    background: '#FEFCE8',
    text: '#18181B',
    muted: '#71717A'
  },
  pastel: {
    primary: '#A5B4FC',
    secondary: ['#C4B5FD', '#DDD6FE', '#E9D5FF'],
    accent: '#FDBA74',
    background: '#FFF7ED',
    text: '#44403C',
    muted: '#A8A29E'
  },
  monochrome: {
    primary: '#374151',
    secondary: ['#4B5563', '#6B7280', '#9CA3AF'],
    accent: '#1F2937',
    background: '#F9FAFB',
    text: '#111827',
    muted: '#D1D5DB'
  },
  gradient: {
    primary: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    secondary: [
      'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
      'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
      'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)'
    ],
    accent: 'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
    background: '#FFFFFF',
    text: '#1A1A2E',
    muted: '#A0AEC0'
  }
}

interface ColorPalette {
  primary: string
  secondary: string[]
  accent: string
  background: string
  text: string
  muted: string
}
```

### Typography

```typescript
const TYPOGRAPHY = {
  title: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 700,
    fontSize: {
      small: '14px',
      medium: '18px',
      large: '24px'
    }
  },
  label: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 600,
    fontSize: {
      small: '11px',
      medium: '13px',
      large: '15px'
    }
  },
  body: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 400,
    fontSize: {
      small: '10px',
      medium: '12px',
      large: '14px'
    }
  },
  number: {
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 700,
    fontSize: {
      small: '16px',
      medium: '24px',
      large: '36px'
    }
  }
}
```

---

## Error Handling

### Error Responses

```typescript
interface IllustratorError {
  code: IllustratorErrorCode
  message: string
  details?: {
    field?: string
    reason?: string
    suggestion?: string
  }
  retryable: boolean
}

// Example error responses
const ERROR_EXAMPLES = {
  INVALID_TYPE: {
    code: 'INVALID_TYPE',
    message: 'Unknown infographic type: "unknown"',
    details: {
      field: 'type',
      reason: 'Must be one of: timeline, process, comparison, ...',
      suggestion: 'Did you mean "timeline"?'
    },
    retryable: false
  },

  GENERATION_FAILED: {
    code: 'GENERATION_FAILED',
    message: 'Failed to generate infographic content',
    details: {
      reason: 'AI model timeout',
      suggestion: 'Try again with a simpler prompt'
    },
    retryable: true
  }
}
```

---

## Rate Limiting

```typescript
const RATE_LIMITS = {
  generate: {
    requestsPerMinute: 15,
    requestsPerHour: 200
  },
  transform: {
    requestsPerMinute: 30,
    requestsPerHour: 500
  }
}
```

---

## Integration with Layout Service

### Orchestration Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  Layout Service  │────▶│  Illustrator AI  │
│   Panel      │     │  Orchestrator    │     │     Service      │
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                      │                        │
       │  1. Type selection   │                        │
       │  2. User prompt      │                        │
       │  3. Style options    │                        │
       │                      │  4. Add context        │
       │                      │  5. Calculate sizing   │
       │                      │  6. Add brand colors   │
       │                      │                        │
       │                      │────────────────────────▶
       │                      │  7. Generate request   │
       │                      │                        │
       │                      │◀────────────────────────
       │                      │  8. SVG + data        │
       │                      │                        │
       │◀─────────────────────│  9. Inject SVG       │
       │  10. Render element  │                        │
```

### Layout Service Responsibilities

1. **Resolve Brand Colors**: From presentation theme
2. **Calculate Optimal Layout**: Based on grid dimensions
3. **Determine Item Limits**: Based on available space
4. **Route Request**: To Illustrator AI Service
5. **Cache SVG**: For fast re-renders
6. **Handle Interactivity**: Item clicks, hovers, edits

---

## Implementation Notes

### SVG Optimization

Generated SVGs should be optimized:

```typescript
interface SVGOptimization {
  // Remove unnecessary attributes
  removeEmptyAttrs: true
  removeUselessDefs: true
  removeXMLProcInst: true
  removeComments: true

  // Optimize paths
  convertPathData: true
  mergePaths: true

  // Minify
  minifyStyles: true
  removeWhitespace: true

  // Accessibility
  addTitleDesc: true
  addAriaLabels: true
}
```

### Accessibility Requirements

```typescript
interface AccessibleSVG {
  // Required attributes
  role: 'img'
  'aria-label': string              // Description of infographic

  // Title and desc elements
  title: string                     // Brief title
  desc: string                      // Detailed description

  // Interactive elements
  focusable: boolean
  tabindex?: number
}
```

### Responsive Behavior

```typescript
// SVG should scale responsively
const RESPONSIVE_SVG_ATTRS = {
  width: '100%',
  height: '100%',
  preserveAspectRatio: 'xMidYMid meet',
  viewBox: '0 0 [width] [height]'
}
```
