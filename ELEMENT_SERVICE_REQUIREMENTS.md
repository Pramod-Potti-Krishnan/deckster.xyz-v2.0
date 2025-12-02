# Element Service Requirements

This document specifies the backend API commands that the Layout Service must support for the new Element Format Panels (Image, Table, Chart, Infographic, Diagram).

## Overview

The frontend now includes format panels for 5 element types:
- **Image**: AI-generated images with style and aspect ratio controls
- **Table**: AI-generated tables with structure and styling
- **Chart**: Data visualizations (bar, line, pie, etc.) with AI data generation
- **Infographic**: Complex visual layouts (12 types) with AI content generation
- **Diagram**: Mermaid-based diagrams (11 types) with AI code generation

Each panel has:
1. **AI Tab**: Element-specific generation controls
2. **Arrange Tab**: Common positioning/sizing controls

---

## Communication Protocol

All commands are sent via the existing `sendTextBoxCommand` API pattern using postMessage.

```typescript
// Frontend sends:
{
  type: 'ELEMENT_COMMAND',
  action: string,      // Command name
  params: {
    elementId: string, // Target element ID
    ...                // Command-specific parameters
  }
}

// Backend responds:
{
  type: 'ELEMENT_COMMAND_RESULT',
  action: string,
  success: boolean,
  data?: any,
  error?: string
}
```

---

## Common Commands (All Element Types)

These commands apply to all element types and are used by the Arrange Tab.

### Element CRUD

| Command | Parameters | Description |
|---------|------------|-------------|
| `insertElement` | `{ type: ElementType, slideIndex: number, position?: {x, y}, size?: {w, h} }` | Insert new element on slide |
| `deleteElement` | `{ elementId: string }` | Remove element from slide |
| `duplicateElement` | `{ elementId: string }` | Clone element at offset position |

### Positioning

| Command | Parameters | Description |
|---------|------------|-------------|
| `setElementPosition` | `{ elementId: string, x: number, y: number }` | Absolute position (% of slide) |
| `setElementSize` | `{ elementId: string, width: number, height: number }` | Size in % of slide dimensions |
| `setElementRotation` | `{ elementId: string, angle: number }` | Rotation in degrees (0-360) |

### Z-Order

| Command | Parameters | Description |
|---------|------------|-------------|
| `bringToFront` | `{ elementId: string }` | Move to highest z-index |
| `sendToBack` | `{ elementId: string }` | Move to lowest z-index |
| `bringForward` | `{ elementId: string }` | Increment z-index by 1 |
| `sendBackward` | `{ elementId: string }` | Decrement z-index by 1 |

### Alignment (Relative to Slide)

| Command | Parameters | Description |
|---------|------------|-------------|
| `alignElement` | `{ elementId: string, alignment: 'left' \| 'center' \| 'right' \| 'top' \| 'middle' \| 'bottom' }` | Align to slide edge/center |
| `distributeElements` | `{ elementIds: string[], direction: 'horizontal' \| 'vertical' }` | Evenly space multiple elements |

### Transforms

| Command | Parameters | Description |
|---------|------------|-------------|
| `flipElement` | `{ elementId: string, direction: 'horizontal' \| 'vertical' }` | Mirror element |
| `resetRotation` | `{ elementId: string }` | Reset rotation to 0 |

### Locking & Grouping

| Command | Parameters | Description |
|---------|------------|-------------|
| `lockElement` | `{ elementId: string, locked: boolean }` | Prevent editing |
| `groupElements` | `{ elementIds: string[] }` | Create element group |
| `ungroupElements` | `{ groupId: string }` | Dissolve group |

---

## Image Element Commands

### AI Generation

| Command | Parameters | Description |
|---------|------------|-------------|
| `generateImage` | `{ elementId: string, prompt: string, style: ImageStyle, aspectRatio: AspectRatio, presentationId: string, slideIndex: number }` | Generate image with AI |
| `regenerateImage` | `{ elementId: string }` | Re-generate with same settings |

### Image Types

```typescript
type ImageStyle = 'realistic' | 'illustration' | 'abstract' | 'minimal' | 'photo'
type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | 'custom'
```

### Expected Response

```typescript
{
  success: true,
  data: {
    imageUrl: string,      // URL to generated image
    thumbnailUrl: string,  // Smaller preview
    generationId: string,  // For regeneration
  }
}
```

---

## Table Element Commands

### AI Generation

| Command | Parameters | Description |
|---------|------------|-------------|
| `generateTableContent` | `{ elementId: string, prompt: string, columns: number, rows: number, hasHeader: boolean, presentationId: string, slideIndex: number }` | Generate table data with AI |

### Styling

| Command | Parameters | Description |
|---------|------------|-------------|
| `setTableStyle` | `{ elementId: string, style: TableStyle }` | Apply table style preset |
| `setTableHeaderStyle` | `{ elementId: string, enabled: boolean }` | Toggle header row styling |
| `setAlternatingRows` | `{ elementId: string, enabled: boolean }` | Toggle zebra striping |

### Table Types

```typescript
type TableStyle = 'minimal' | 'bordered' | 'striped' | 'modern' | 'professional'
```

### Expected Response

```typescript
{
  success: true,
  data: {
    tableHtml: string,     // Rendered table HTML
    tableData: string[][],  // Raw cell data
    columns: number,
    rows: number
  }
}
```

---

## Chart Element Commands

### AI Generation

| Command | Parameters | Description |
|---------|------------|-------------|
| `generateChartData` | `{ elementId: string, prompt: string, chartType: ChartType, colorPalette: ChartPalette, presentationId: string, slideIndex: number }` | Generate chart data with AI |

### Configuration

| Command | Parameters | Description |
|---------|------------|-------------|
| `setChartType` | `{ elementId: string, type: ChartType }` | Change chart visualization type |
| `setChartColors` | `{ elementId: string, palette: ChartPalette, customColors?: string[] }` | Apply color scheme |
| `setChartLabels` | `{ elementId: string, title?: string, xLabel?: string, yLabel?: string }` | Set axis labels |
| `setChartOptions` | `{ elementId: string, showLegend: boolean, showGrid: boolean, animated: boolean }` | Toggle chart features |

### Chart Types

```typescript
type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar' | 'polarArea'

type ChartPalette = 'default' | 'professional' | 'vibrant' | 'pastel' | 'monochrome'

// Palette color definitions
const CHART_PALETTES = {
  default: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
  professional: ['#1E40AF', '#166534', '#B45309', '#991B1B', '#5B21B6', '#9D174D'],
  vibrant: ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'],
  pastel: ['#93C5FD', '#86EFAC', '#FCD34D', '#FCA5A5', '#C4B5FD', '#F9A8D4'],
  monochrome: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB']
}
```

### Expected Response

```typescript
{
  success: true,
  data: {
    chartConfig: {
      type: ChartType,
      data: {
        labels: string[],
        datasets: Array<{
          label: string,
          data: number[],
          backgroundColor: string | string[],
          borderColor?: string
        }>
      },
      options: object
    }
  }
}
```

---

## Infographic Element Commands

### AI Generation

| Command | Parameters | Description |
|---------|------------|-------------|
| `generateInfographic` | `{ elementId: string, prompt: string, type: InfographicType, presentationId: string, slideIndex: number }` | Generate infographic with AI |

### Infographic Types (12 total)

```typescript
type InfographicType =
  | 'timeline'    // Linear progression of events
  | 'process'     // Step-by-step workflow
  | 'comparison'  // Side-by-side analysis
  | 'statistics'  // Numbers & percentages
  | 'hierarchy'   // Org chart or tree
  | 'list'        // Numbered or icon list
  | 'cycle'       // Circular process
  | 'pyramid'     // Layered hierarchy
  | 'matrix'      // Grid comparison
  | 'venn'        // Overlapping concepts
  | 'funnel'      // Narrowing stages
  | 'roadmap'     // Project timeline
```

### Expected Response

```typescript
{
  success: true,
  data: {
    svgContent: string,        // Rendered SVG
    htmlContent: string,       // Alternative HTML representation
    infographicData: {
      type: InfographicType,
      items: Array<{
        id: string,
        title: string,
        description?: string,
        icon?: string,
        value?: number | string,
        color?: string
      }>
    }
  }
}
```

---

## Diagram Element Commands

### AI Generation

| Command | Parameters | Description |
|---------|------------|-------------|
| `generateDiagram` | `{ elementId: string, prompt: string, type: DiagramType, direction: DiagramDirection, theme: DiagramTheme, presentationId: string, slideIndex: number }` | Generate Mermaid diagram with AI |

### Configuration

| Command | Parameters | Description |
|---------|------------|-------------|
| `setDiagramTheme` | `{ elementId: string, theme: DiagramTheme }` | Change Mermaid theme |
| `setDiagramDirection` | `{ elementId: string, direction: DiagramDirection }` | Change flow direction |
| `updateDiagramCode` | `{ elementId: string, mermaidCode: string }` | Manual code update |

### Diagram Types (11 Mermaid Types)

```typescript
type DiagramType =
  | 'flowchart'   // Process flows & decisions
  | 'sequence'    // Interaction sequences
  | 'class'       // UML class diagrams
  | 'state'       // State machine diagrams
  | 'er'          // Entity-relationship diagrams
  | 'gantt'       // Project timelines
  | 'userjourney' // User experience flow
  | 'gitgraph'    // Git branch visualization
  | 'mindmap'     // Hierarchical ideas
  | 'pie'         // Simple pie charts
  | 'timeline'    // Historical events

type DiagramDirection = 'TB' | 'BT' | 'LR' | 'RL'
// TB = Top to Bottom, BT = Bottom to Top
// LR = Left to Right, RL = Right to Left

type DiagramTheme = 'default' | 'forest' | 'dark' | 'neutral'
```

### Expected Response

```typescript
{
  success: true,
  data: {
    mermaidCode: string,  // Raw Mermaid syntax
    svgContent: string,   // Rendered SVG
    diagramType: DiagramType
  }
}
```

---

## Element Selection Events

The Layout Service should emit these events when elements are selected/deselected in the slide:

### Element Selected

```typescript
{
  type: 'ELEMENT_SELECTED',
  data: {
    elementId: string,
    elementType: ElementType,
    properties: {
      position: { x: number, y: number },
      size: { width: number, height: number },
      rotation: number,
      locked: boolean,
      zIndex: number,
      flipped?: { horizontal: boolean, vertical: boolean },
      // Type-specific properties...
    }
  }
}
```

### Element Deselected

```typescript
{
  type: 'ELEMENT_DESELECTED',
  data: {
    elementId: string
  }
}
```

### Element Updated

```typescript
{
  type: 'ELEMENT_UPDATED',
  data: {
    elementId: string,
    properties: Partial<ElementProperties>
  }
}
```

---

## Priority Implementation Order

Based on user impact and complexity:

### Phase 1 - Core Infrastructure (Required)
1. `insertElement` - Insert elements on slide
2. `deleteElement` - Remove elements
3. Element selection events
4. `setElementPosition` - Positioning
5. `setElementSize` - Sizing

### Phase 2 - AI Generation (High Value)
1. `generateImage` - AI image generation
2. `generateDiagram` - Mermaid diagram generation
3. `generateChartData` - Chart data generation
4. `generateTableContent` - Table content generation
5. `generateInfographic` - Infographic generation

### Phase 3 - Arrangement (User Experience)
1. Z-order commands (front/back)
2. Alignment commands
3. Rotation commands
4. Lock/unlock

### Phase 4 - Advanced
1. Grouping
2. Flip transforms
3. Element duplication
4. Distribution

---

## Error Handling

All commands should return standardized errors:

```typescript
{
  success: false,
  error: string,
  errorCode: 'ELEMENT_NOT_FOUND' | 'INVALID_PARAMS' | 'AI_GENERATION_FAILED' | 'PERMISSION_DENIED' | 'SLIDE_NOT_FOUND'
}
```

---

## Notes for Backend Team

1. **Element IDs**: Use UUIDs for element identification
2. **Position/Size**: All values are percentages of slide dimensions (0-100)
3. **AI Generation**: Should be async with progress updates for long operations
4. **Mermaid Rendering**: Can be done client-side or server-side (client-side recommended)
5. **Chart Rendering**: Uses Chart.js configuration format
6. **Infographics**: Can be SVG or HTML-based layouts
7. **State Persistence**: All element state should be saved to presentation document

---

## Frontend Files Reference

- `types/elements.ts` - Type definitions
- `components/element-format-panel/` - Panel components
- `hooks/use-element-panel.ts` - Selection state management
- `components/presentation-viewer.tsx` - Toolbar buttons and insert handlers
