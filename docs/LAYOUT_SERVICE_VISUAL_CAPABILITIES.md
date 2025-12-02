# Layout Service Visual Capabilities

This document specifies all non-AI visual rendering and element manipulation capabilities that the Layout Service must implement. These are core features fully within the control of the Layout Service.

---

## 1. Grid System

### 1.1 Slide Dimensions
- **Default Resolution**: 1920 × 1080 pixels (16:9)
- **Alternative Resolutions**:
  - 1024 × 768 (4:3)
  - 1080 × 1920 (9:16 portrait)
  - Custom dimensions

### 1.2 Grid Configuration
```typescript
interface GridConfig {
  columns: number      // Default: 12
  rows: number         // Default: 8
  gutterX: number      // Horizontal gutter (px)
  gutterY: number      // Vertical gutter (px)
  marginX: number      // Slide margin horizontal (px)
  marginY: number      // Slide margin vertical (px)
}

// Calculate grid unit dimensions
const gridUnitWidth = (slideWidth - (marginX * 2) - (gutterX * (columns - 1))) / columns
const gridUnitHeight = (slideHeight - (marginY * 2) - (gutterY * (rows - 1))) / rows
```

### 1.3 Grid-to-Percentage Conversion
```typescript
// Convert grid position to percentage
function gridToPercent(gridX: number, gridY: number, config: GridConfig): { x: number, y: number } {
  return {
    x: (gridX / config.columns) * 100,
    y: (gridY / config.rows) * 100
  }
}

// Convert percentage to grid position
function percentToGrid(percentX: number, percentY: number, config: GridConfig): { x: number, y: number } {
  return {
    x: Math.round((percentX / 100) * config.columns),
    y: Math.round((percentY / 100) * config.rows)
  }
}
```

### 1.4 Snap-to-Grid Functionality
- **Snap Threshold**: 10px proximity to grid line
- **Snap Behavior**: Element snaps to nearest grid intersection
- **Visual Feedback**: Highlight grid lines during drag
- **Toggle**: User can enable/disable snap-to-grid

### 1.5 Grid Overlay Rendering
- Show/hide grid lines toggle
- Grid line color: rgba(128, 128, 128, 0.3)
- Grid intersection dots
- Ruler marks on edges (optional)

---

## 2. Element Rendering by Type

### 2.1 Text Box Rendering

| Capability | Implementation | CSS Properties |
|------------|----------------|----------------|
| Rich text HTML | innerHTML injection | - |
| Font family | Dynamic font loading | `font-family` |
| Font size | Range: 8pt - 120pt | `font-size` |
| Font weight | 100-900, normal, bold | `font-weight` |
| Text color | Hex, RGB, RGBA | `color` |
| Background | Solid, gradient | `background` |
| Alignment (H) | left, center, right, justify | `text-align` |
| Alignment (V) | top, middle, bottom | `display: flex; align-items` |
| Line height | 1.0 - 3.0 | `line-height` |
| Padding | All sides | `padding` |
| Border | Width, style, color, radius | `border`, `border-radius` |
| Text overflow | clip, scroll, auto-resize | `overflow`, auto-height calc |
| Columns | 1-4 columns | `column-count` |

**Text Box Commands:**
```typescript
interface TextBoxRenderCommands {
  setTextBoxContent(elementId: string, html: string): void
  setTextBoxFont(elementId: string, fontFamily: string): void
  setTextBoxFontSize(elementId: string, size: string): void
  setTextBoxFontWeight(elementId: string, weight: string): void
  setTextBoxColor(elementId: string, color: string): void
  setTextBoxBackground(elementId: string, background: string): void
  setTextBoxAlignment(elementId: string, horizontal: string, vertical?: string): void
  setTextBoxLineHeight(elementId: string, lineHeight: number): void
  setTextBoxPadding(elementId: string, padding: string): void
  setTextBoxBorder(elementId: string, border: BorderConfig): void
  setTextBoxColumns(elementId: string, columns: number): void
  setTextBoxOverflow(elementId: string, overflow: 'clip' | 'scroll' | 'auto'): void
}
```

### 2.2 Image Rendering

| Capability | Implementation | Details |
|------------|----------------|---------|
| Image loading | Async fetch with loading state | Show spinner until loaded |
| Object fit | cover, contain, fill, none | `object-fit` CSS |
| Placeholder | Skeleton or icon placeholder | Gray box with image icon |
| Error state | Error icon + retry button | Show on load failure |
| Border | Optional border styling | Same as text box |
| Border radius | 0 - 50% (for circular) | `border-radius` |
| Shadow | Optional drop shadow | `box-shadow` |
| Filters | Brightness, contrast, saturation | `filter` CSS |
| Opacity | 0 - 100% | `opacity` |

**Image Commands:**
```typescript
interface ImageRenderCommands {
  setImageSource(elementId: string, url: string): void
  setImageObjectFit(elementId: string, fit: 'cover' | 'contain' | 'fill' | 'none'): void
  setImageBorder(elementId: string, border: BorderConfig): void
  setImageBorderRadius(elementId: string, radius: string): void
  setImageShadow(elementId: string, shadow: string): void
  setImageFilters(elementId: string, filters: FilterConfig): void
  setImageOpacity(elementId: string, opacity: number): void
}

interface FilterConfig {
  brightness?: number  // 0-200, default 100
  contrast?: number    // 0-200, default 100
  saturation?: number  // 0-200, default 100
  grayscale?: number   // 0-100, default 0
  blur?: number        // 0-20px, default 0
}
```

### 2.3 Table Rendering

| Capability | Implementation | Details |
|------------|----------------|---------|
| HTML table | `<table>` element rendering | Semantic HTML |
| Cell borders | Configurable per-cell | `border` CSS |
| Cell padding | Uniform or per-cell | `padding` CSS |
| Cell colors | Background per cell/row | `background-color` |
| Header styling | Distinct header row | Bold, different bg |
| Alternating rows | Zebra striping | Even/odd row colors |
| Column widths | Auto, fixed, percentage | `width` on `<col>` |
| Cell alignment | Per-cell H/V alignment | `text-align`, `vertical-align` |
| Font styling | Per-cell font settings | Inherit or override |

**Table Style Presets:**
```typescript
type TableStyle = 'minimal' | 'bordered' | 'striped' | 'modern' | 'professional'

const TABLE_STYLES: Record<TableStyle, TableStyleConfig> = {
  minimal: {
    border: 'none',
    headerBg: 'transparent',
    headerWeight: 'bold',
    rowBg: 'transparent',
    altRowBg: 'transparent'
  },
  bordered: {
    border: '1px solid #e5e7eb',
    headerBg: '#f9fafb',
    headerWeight: 'bold',
    rowBg: '#ffffff',
    altRowBg: '#ffffff'
  },
  striped: {
    border: 'none',
    headerBg: '#f3f4f6',
    headerWeight: 'bold',
    rowBg: '#ffffff',
    altRowBg: '#f9fafb'
  },
  modern: {
    border: 'none',
    borderBottom: '1px solid #e5e7eb',
    headerBg: 'transparent',
    headerWeight: '600',
    rowBg: 'transparent',
    altRowBg: 'transparent'
  },
  professional: {
    border: '1px solid #d1d5db',
    headerBg: '#1f2937',
    headerColor: '#ffffff',
    headerWeight: 'bold',
    rowBg: '#ffffff',
    altRowBg: '#f9fafb'
  }
}
```

**Table Commands:**
```typescript
interface TableRenderCommands {
  setTableStyle(elementId: string, style: TableStyle): void
  setTableCellContent(elementId: string, row: number, col: number, content: string): void
  setTableCellStyle(elementId: string, row: number, col: number, style: CellStyle): void
  setTableHeaderEnabled(elementId: string, enabled: boolean): void
  setTableAlternatingRows(elementId: string, enabled: boolean): void
  setTableColumnWidth(elementId: string, col: number, width: string): void
  addTableRow(elementId: string, index?: number): void
  deleteTableRow(elementId: string, index: number): void
  addTableColumn(elementId: string, index?: number): void
  deleteTableColumn(elementId: string, index: number): void
}
```

### 2.4 Chart Rendering

| Capability | Implementation | Library |
|------------|----------------|---------|
| Chart types | bar, line, pie, doughnut, area, scatter, radar, polarArea | Chart.js |
| Canvas/SVG | Canvas preferred for performance | `<canvas>` element |
| Animations | Enable/disable, duration | Chart.js options |
| Legend | Position, visibility | Top, bottom, left, right, hidden |
| Axis labels | X/Y axis labels and titles | Chart.js scales |
| Grid lines | Show/hide, styling | Chart.js grid options |
| Tooltips | Interactive data tooltips | Chart.js tooltip plugin |
| Responsive | Scale to container | `responsive: true` |

**Chart.js Integration:**
```typescript
interface ChartRenderConfig {
  type: ChartType
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor: string | string[]
      borderColor?: string
      borderWidth?: number
      fill?: boolean
    }>
  }
  options: {
    responsive: boolean
    maintainAspectRatio: boolean
    animation?: { duration: number } | false
    plugins: {
      legend: { display: boolean, position: 'top' | 'bottom' | 'left' | 'right' }
      title: { display: boolean, text: string }
      tooltip: { enabled: boolean }
    }
    scales?: {
      x: { display: boolean, title: { display: boolean, text: string } }
      y: { display: boolean, title: { display: boolean, text: string } }
    }
  }
}
```

**Chart Commands:**
```typescript
interface ChartRenderCommands {
  setChartType(elementId: string, type: ChartType): void
  setChartData(elementId: string, data: ChartData): void
  setChartColors(elementId: string, colors: string[]): void
  setChartLegend(elementId: string, config: LegendConfig): void
  setChartTitle(elementId: string, title: string): void
  setChartAxisLabels(elementId: string, xLabel: string, yLabel: string): void
  setChartAnimation(elementId: string, enabled: boolean): void
  setChartGridLines(elementId: string, showX: boolean, showY: boolean): void
  refreshChart(elementId: string): void
}
```

### 2.5 Infographic Rendering

| Capability | Implementation | Details |
|------------|----------------|---------|
| SVG rendering | Direct SVG injection | `<svg>` element |
| Icon integration | Lucide/custom icons | Inline SVG icons |
| Layout templates | 12 predefined layouts | Timeline, process, etc. |
| Responsive scaling | ViewBox-based scaling | `viewBox` attribute |
| Color theming | Dynamic color application | CSS variables or inline |
| Text rendering | `<text>` or `<foreignObject>` | For rich text support |

**Infographic Layout Templates:**
```typescript
type InfographicType =
  | 'timeline'    // Horizontal or vertical timeline
  | 'process'     // Step-by-step flow with arrows
  | 'comparison'  // Side-by-side comparison
  | 'statistics'  // Big numbers with labels
  | 'hierarchy'   // Org chart / tree
  | 'list'        // Icon + text list
  | 'cycle'       // Circular flow diagram
  | 'pyramid'     // Layered pyramid
  | 'matrix'      // 2x2 or grid comparison
  | 'venn'        // Overlapping circles
  | 'funnel'      // Narrowing funnel
  | 'roadmap'     // Timeline with milestones

interface InfographicTemplate {
  type: InfographicType
  svgTemplate: string        // Base SVG with placeholders
  itemPositions: Position[]  // Where items go
  maxItems: number           // Maximum items supported
  defaultColors: string[]    // Default color scheme
}
```

**Infographic Commands:**
```typescript
interface InfographicRenderCommands {
  setInfographicType(elementId: string, type: InfographicType): void
  setInfographicContent(elementId: string, svgContent: string): void
  setInfographicColors(elementId: string, colors: string[]): void
  updateInfographicItem(elementId: string, itemId: string, content: ItemContent): void
  addInfographicItem(elementId: string, item: ItemContent): void
  removeInfographicItem(elementId: string, itemId: string): void
  reorderInfographicItems(elementId: string, itemIds: string[]): void
}
```

### 2.6 Diagram Rendering (Mermaid)

| Capability | Implementation | Details |
|------------|----------------|---------|
| Mermaid parsing | mermaid.js library | Parse diagram definition |
| SVG output | Mermaid generates SVG | Inject into container |
| Themes | default, forest, dark, neutral | Mermaid theme config |
| Direction | TB, BT, LR, RL | Flowchart direction |
| Interactive | Pan/zoom (optional) | SVG transform |
| Error handling | Syntax error display | Show error message |

**Mermaid Integration:**
```typescript
interface MermaidConfig {
  theme: 'default' | 'forest' | 'dark' | 'neutral'
  flowchart: {
    htmlLabels: boolean
    curve: 'basis' | 'linear' | 'cardinal'
    diagramPadding: number
  }
  sequence: {
    diagramMarginX: number
    diagramMarginY: number
    actorMargin: number
    width: number
  }
}

// Render mermaid diagram
async function renderMermaidDiagram(
  elementId: string,
  mermaidCode: string,
  config: MermaidConfig
): Promise<string> {
  const { svg } = await mermaid.render(`mermaid-${elementId}`, mermaidCode)
  return svg
}
```

**Diagram Commands:**
```typescript
interface DiagramRenderCommands {
  setDiagramCode(elementId: string, mermaidCode: string): void
  setDiagramTheme(elementId: string, theme: MermaidTheme): void
  setDiagramDirection(elementId: string, direction: 'TB' | 'BT' | 'LR' | 'RL'): void
  renderDiagram(elementId: string): Promise<void>
  getDiagramSvg(elementId: string): string
}
```

---

## 3. Element Manipulation

### 3.1 Selection

| Feature | Implementation | Visual Feedback |
|---------|----------------|-----------------|
| Single select | Click on element | Blue border + handles |
| Multi-select | Shift+click or drag box | All selected highlighted |
| Deselect | Click outside / ESC | Remove selection UI |
| Select all | Ctrl/Cmd + A | All elements selected |

**Selection State:**
```typescript
interface SelectionState {
  selectedIds: string[]
  primarySelection: string | null  // For property panel
  selectionBounds: {
    x: number
    y: number
    width: number
    height: number
  } | null
}
```

### 3.2 Drag-and-Drop Positioning

| Feature | Implementation | Details |
|---------|----------------|---------|
| Drag start | mousedown on element | Store initial position |
| Drag move | mousemove | Update position in real-time |
| Drag end | mouseup | Commit position, emit event |
| Snap guides | Show alignment lines | Snap to other elements/grid |
| Bounds check | Prevent off-slide | Clamp to slide bounds |

**Drag Configuration:**
```typescript
interface DragConfig {
  snapToGrid: boolean
  snapThreshold: number  // px
  showAlignmentGuides: boolean
  constrainToSlide: boolean
  allowOffSlide: boolean  // For animations
}
```

### 3.3 Resize Handles

| Handle | Position | Cursor | Behavior |
|--------|----------|--------|----------|
| NW | Top-left | `nwse-resize` | Resize from corner |
| N | Top-center | `ns-resize` | Resize height only |
| NE | Top-right | `nesw-resize` | Resize from corner |
| E | Right-center | `ew-resize` | Resize width only |
| SE | Bottom-right | `nwse-resize` | Resize from corner |
| S | Bottom-center | `ns-resize` | Resize height only |
| SW | Bottom-left | `nesw-resize` | Resize from corner |
| W | Left-center | `ew-resize` | Resize width only |

**Resize with Aspect Ratio:**
```typescript
function resizeWithAspectRatio(
  element: ElementBounds,
  handle: ResizeHandle,
  delta: { x: number, y: number },
  maintainAspect: boolean
): ElementBounds {
  if (!maintainAspect) {
    return applyResizeDelta(element, handle, delta)
  }

  const aspectRatio = element.width / element.height
  // Calculate new dimensions maintaining aspect ratio
  // Based on which handle is being dragged
  // ...
}
```

### 3.4 Rotation Handle

| Feature | Implementation | Details |
|---------|----------------|---------|
| Handle position | Above top-center | 20px above element |
| Rotation center | Element center | Rotate around center |
| Snap angles | 0, 45, 90, 135, 180, 225, 270, 315 | 15-degree snap threshold |
| Visual feedback | Show angle while rotating | Tooltip with degree value |

**Rotation Implementation:**
```typescript
function calculateRotation(
  center: Point,
  mousePosition: Point,
  snapToAngles: boolean
): number {
  const angle = Math.atan2(
    mousePosition.y - center.y,
    mousePosition.x - center.x
  ) * (180 / Math.PI) + 90

  if (snapToAngles) {
    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315]
    const snapThreshold = 5 // degrees
    for (const snap of snapAngles) {
      if (Math.abs(angle - snap) < snapThreshold) {
        return snap
      }
    }
  }

  return angle
}
```

### 3.5 Snap Guides (Alignment Lines)

| Guide Type | Trigger | Visual |
|------------|---------|--------|
| Element edge | Near another element's edge | Red line |
| Element center | Near another element's center | Dashed red line |
| Slide center | Near slide H/V center | Blue line |
| Grid line | Near grid intersection | Gray line |

**Snap Guide Detection:**
```typescript
interface SnapGuide {
  type: 'edge' | 'center' | 'grid'
  orientation: 'horizontal' | 'vertical'
  position: number  // px from slide origin
  sourceElementId?: string
}

function detectSnapGuides(
  draggingElement: ElementBounds,
  otherElements: ElementBounds[],
  slideSize: Size,
  threshold: number
): SnapGuide[] {
  const guides: SnapGuide[] = []

  // Check alignment with other elements
  for (const other of otherElements) {
    // Left edge alignment
    if (Math.abs(draggingElement.x - other.x) < threshold) {
      guides.push({ type: 'edge', orientation: 'vertical', position: other.x })
    }
    // Center alignment
    // ... etc
  }

  // Check slide center
  // Check grid lines

  return guides
}
```

---

## 4. Z-Index Management

### 4.1 Layer Ordering

| Command | Description | Implementation |
|---------|-------------|----------------|
| `bringToFront` | Move to highest layer | Set z-index to max + 1 |
| `sendToBack` | Move to lowest layer | Set z-index to min - 1 |
| `bringForward` | Move one layer up | Swap with next higher |
| `sendBackward` | Move one layer down | Swap with next lower |

**Z-Index Management:**
```typescript
interface ZIndexManager {
  getElementZIndex(elementId: string): number
  setElementZIndex(elementId: string, zIndex: number): void
  bringToFront(elementId: string): void
  sendToBack(elementId: string): void
  bringForward(elementId: string): void
  sendBackward(elementId: string): void
  normalizeZIndexes(): void  // Re-normalize to 0, 1, 2, ...
}

// Implementation
class ZIndexManagerImpl implements ZIndexManager {
  private elements: Map<string, number> = new Map()

  bringToFront(elementId: string): void {
    const maxZ = Math.max(...this.elements.values())
    this.elements.set(elementId, maxZ + 1)
  }

  sendToBack(elementId: string): void {
    const minZ = Math.min(...this.elements.values())
    this.elements.set(elementId, minZ - 1)
  }

  bringForward(elementId: string): void {
    const currentZ = this.elements.get(elementId) ?? 0
    const nextHigher = this.findNextHigher(currentZ)
    if (nextHigher) {
      // Swap z-indexes
      this.elements.set(elementId, nextHigher.zIndex)
      this.elements.set(nextHigher.elementId, currentZ)
    }
  }

  // ...
}
```

### 4.2 Visual Layer Panel (Optional)

- Show thumbnail list of elements sorted by z-index
- Drag to reorder
- Show element type icon
- Lock/unlock per layer
- Show/hide per layer

---

## 5. Transform Operations

### 5.1 Rotation

| Feature | Range | Details |
|---------|-------|---------|
| Angle | 0° - 360° | Clockwise from top |
| Origin | Element center | CSS `transform-origin: center` |
| Input | Handle drag or direct input | Number field in Arrange tab |
| Precision | 0.1° | One decimal place |

**Rotation Commands:**
```typescript
interface RotationCommands {
  setRotation(elementId: string, angle: number): void
  rotateBy(elementId: string, delta: number): void
  resetRotation(elementId: string): void
  getRotation(elementId: string): number
}
```

### 5.2 Flip

| Operation | Implementation | CSS |
|-----------|----------------|-----|
| Flip Horizontal | Mirror on Y-axis | `transform: scaleX(-1)` |
| Flip Vertical | Mirror on X-axis | `transform: scaleY(-1)` |

**Flip Commands:**
```typescript
interface FlipCommands {
  flipHorizontal(elementId: string): void
  flipVertical(elementId: string): void
  getFlipState(elementId: string): { horizontal: boolean, vertical: boolean }
}
```

### 5.3 Scale

| Feature | Implementation | Details |
|---------|----------------|---------|
| Scale factor | 0.1 - 10.0 | Relative to original |
| Aspect lock | Optional | Maintain proportions |
| Scale origin | Element center | Or corner for resize |

---

## 6. Grouping

### 6.1 Group Creation

| Action | Trigger | Result |
|--------|---------|--------|
| Create group | Select 2+ elements, Group command | New group element |
| Group ID | UUID | `group-{uuid}` |
| Member IDs | Stored in group | Array of element IDs |

**Group Structure:**
```typescript
interface ElementGroup {
  groupId: string
  memberIds: string[]
  bounds: ElementBounds  // Calculated from members
  locked: boolean
}

interface GroupCommands {
  createGroup(elementIds: string[]): string  // Returns groupId
  dissolveGroup(groupId: string): string[]   // Returns member IDs
  addToGroup(groupId: string, elementId: string): void
  removeFromGroup(groupId: string, elementId: string): void
  getGroupMembers(groupId: string): string[]
  isGrouped(elementId: string): string | null  // Returns groupId or null
}
```

### 6.2 Group Behavior

| Behavior | Description |
|----------|-------------|
| Select group | Click any member selects entire group |
| Move group | All members move together |
| Resize group | All members scale proportionally |
| Rotate group | All members rotate around group center |
| Edit member | Double-click to enter group, edit single element |

### 6.3 Nested Groups

- Groups can contain other groups
- Maximum nesting depth: 3 levels
- Flatten option to remove nesting

---

## 7. Event System

### 7.1 Element Events

```typescript
type ElementEvent =
  | { type: 'ELEMENT_SELECTED', elementId: string, elementType: ElementType }
  | { type: 'ELEMENT_DESELECTED', elementId: string }
  | { type: 'ELEMENT_MOVED', elementId: string, position: Position }
  | { type: 'ELEMENT_RESIZED', elementId: string, size: Size }
  | { type: 'ELEMENT_ROTATED', elementId: string, angle: number }
  | { type: 'ELEMENT_DELETED', elementId: string }
  | { type: 'ELEMENT_CREATED', elementId: string, elementType: ElementType }
  | { type: 'ELEMENT_UPDATED', elementId: string, properties: Partial<ElementProperties> }
  | { type: 'ELEMENT_LOCKED', elementId: string, locked: boolean }
  | { type: 'ELEMENT_GROUPED', groupId: string, memberIds: string[] }
  | { type: 'ELEMENT_UNGROUPED', groupId: string, memberIds: string[] }
```

### 7.2 Selection Events

```typescript
type SelectionEvent =
  | { type: 'SELECTION_CHANGED', selectedIds: string[] }
  | { type: 'SELECTION_CLEARED' }
```

### 7.3 Event Communication

- Use `postMessage` for iframe communication
- Use WebSocket for real-time sync
- Debounce frequent events (move, resize) - 16ms

---

## 8. Performance Considerations

### 8.1 Rendering Optimization

| Technique | Implementation |
|-----------|----------------|
| Virtual rendering | Only render visible elements |
| Throttled updates | Limit re-renders to 60fps |
| Hardware acceleration | Use `transform` and `opacity` for animations |
| Image lazy loading | Load images as they come into view |
| SVG optimization | Simplify paths, remove unnecessary attributes |

### 8.2 Memory Management

- Dispose Chart.js instances on element delete
- Clear SVG cache periodically
- Unload off-screen images
- Limit undo history depth (20 steps)

---

## 9. Accessibility

### 9.1 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move to next element |
| Shift+Tab | Move to previous element |
| Arrow keys | Nudge selected element (1px) |
| Shift+Arrow | Nudge 10px |
| Delete/Backspace | Delete selected |
| Ctrl/Cmd+A | Select all |
| Escape | Deselect / Cancel operation |

### 9.2 Screen Reader Support

- ARIA labels on all interactive elements
- Announce selection changes
- Describe element type and position
