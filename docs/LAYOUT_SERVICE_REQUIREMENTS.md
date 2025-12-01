# Layout Service API Requirements

This document outlines the API features needed from Layout Service to enable frontend toolbar functionality and AI-powered editing features.

## Current API Status (v7.5.2)

### Available APIs (Working)

| Feature | API Command | Parameters | Status |
|---------|------------|------------|--------|
| Navigation | `nextSlide` | none | Available |
| Navigation | `prevSlide` | none | Available |
| Navigation | `goToSlide` | `{ index: number }` | Available |
| Slide Info | `getCurrentSlideInfo` | none | Available |
| Edit Mode | `toggleEditMode` | none | Available |
| Save | `forceSave` | none | Available |
| Save | `saveAllChanges` | none | Available |
| Add Slide | `addSlide` | `{ layout: string, position: number }` | Available |
| Delete Slide | `deleteSlide` | `{ index: number }` | Available |
| Duplicate Slide | `duplicateSlide` | `{ index: number, insert_after: boolean }` | Available |
| Change Layout | `changeSlideLayout` | `{ index: number, new_layout: string, preserve_content: boolean }` | Available |
| Reorder Slides | `reorderSlides` | `{ from_index: number, to_index: number }` | Available |
| Review Mode | `toggleReviewMode` | none | Available |
| Review Mode | `getSelectedSections` | none | Available |
| Review Mode | `clearSelection` | none | Available |

---

## Requested APIs

### Priority 1: Text Formatting (Enables "T" toolbar button)

**Purpose**: Apply formatting to selected text within slides

**API Command**: `formatText`

```typescript
interface FormatTextParams {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontSize?: number        // e.g., 12, 14, 16, 18, 24, 32
  fontFamily?: string      // e.g., 'Arial', 'Roboto', 'Open Sans'
  color?: string           // hex color e.g., '#FF0000'
  backgroundColor?: string // hex color for highlight
  alignment?: 'left' | 'center' | 'right' | 'justify'
}

// Request
{
  action: 'formatText',
  params: FormatTextParams
}

// Response
{
  action: 'formatText',
  success: boolean,
  error?: string
}
```

**Use Case**: When user selects text and clicks formatting buttons, apply styling.

---

### Priority 1: Section Content Update (Enables AI Regeneration)

**Purpose**: Replace content in a specific slide section (for AI-generated content)

**API Command**: `updateSectionContent`

```typescript
interface UpdateSectionParams {
  slideIndex: number      // 0-based slide index
  sectionId: string       // Section identifier from getSelectedSections
  content: string         // New content (plain text or HTML)
  contentType: 'text' | 'html'
}

// Request
{
  action: 'updateSectionContent',
  params: UpdateSectionParams
}

// Response
{
  action: 'updateSectionContent',
  success: boolean,
  error?: string
}
```

**Use Case**: AI regenerates section content, frontend needs to inject it into the slide.

---

### Priority 2: Shape Insertion (Enables Shape toolbar button)

**Purpose**: Insert shapes into slides

**API Command**: `insertShape`

```typescript
interface InsertShapeParams {
  type: 'rectangle' | 'roundedRect' | 'circle' | 'ellipse' | 'arrow' | 'line' | 'callout' | 'star'
  position: {
    x: number  // percentage from left (0-100)
    y: number  // percentage from top (0-100)
  }
  size: {
    width: number   // percentage of slide width
    height: number  // percentage of slide height
  }
  style?: {
    fill?: string          // hex color
    stroke?: string        // hex color
    strokeWidth?: number   // pixels
    opacity?: number       // 0-1
  }
}

// Request
{
  action: 'insertShape',
  params: InsertShapeParams
}

// Response
{
  action: 'insertShape',
  success: boolean,
  shapeId?: string,  // ID for later manipulation
  error?: string
}
```

---

### Priority 2: Table Insertion (Enables Table toolbar button)

**Purpose**: Insert tables into slides

**API Command**: `insertTable`

```typescript
interface InsertTableParams {
  rows: number           // 1-20
  cols: number           // 1-10
  position: {
    x: number  // percentage from left
    y: number  // percentage from top
  }
  size?: {
    width: number   // percentage of slide width (default: auto-fit)
    height: number  // percentage of slide height (default: auto-fit)
  }
  data?: string[][]      // Initial cell data
  style?: {
    headerRow?: boolean  // First row is header
    borderColor?: string
    headerBackground?: string
  }
}

// Request
{
  action: 'insertTable',
  params: InsertTableParams
}

// Response
{
  action: 'insertTable',
  success: boolean,
  tableId?: string,
  error?: string
}
```

---

### Priority 3: Chart Insertion (Enables Chart toolbar button)

**Purpose**: Insert data visualizations into slides

**API Command**: `insertChart`

```typescript
interface InsertChartParams {
  type: 'bar' | 'horizontalBar' | 'line' | 'pie' | 'donut' | 'area'
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      values: number[]
      color?: string
    }>
  }
  position: {
    x: number
    y: number
  }
  size: {
    width: number
    height: number
  }
  options?: {
    title?: string
    showLegend?: boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    showValues?: boolean
  }
}

// Request
{
  action: 'insertChart',
  params: InsertChartParams
}

// Response
{
  action: 'insertChart',
  success: boolean,
  chartId?: string,
  error?: string
}
```

---

### Priority 3: Get Selection Info (Enhanced)

**Purpose**: Get detailed info about currently selected element

**API Command**: `getSelectionInfo`

```typescript
// Request
{
  action: 'getSelectionInfo',
  params: {}
}

// Response
{
  action: 'getSelectionInfo',
  success: boolean,
  data: {
    type: 'none' | 'text' | 'shape' | 'table' | 'chart' | 'image'
    slideIndex: number
    elementId?: string
    bounds?: {
      x: number
      y: number
      width: number
      height: number
    }
    // For text selection
    textContent?: string
    formatting?: {
      bold: boolean
      italic: boolean
      underline: boolean
      fontSize: number
      fontFamily: string
      color: string
    }
  }
}
```

---

## Feature Dependency Matrix

| Frontend Feature | Required API | Priority | Blocked? |
|-----------------|--------------|----------|----------|
| Text toolbar button (T) | `formatText` | P1 | Yes |
| AI Section Regeneration | `updateSectionContent` | P1 | Yes |
| Shape toolbar button | `insertShape` | P2 | Yes |
| Table toolbar button | `insertTable` | P2 | Yes |
| Chart toolbar button | `insertChart` | P3 | Yes |
| Format Panel | `getSelectionInfo` | P3 | Partial |

---

## Implementation Notes

### postMessage Protocol

All APIs use the existing postMessage protocol:

```typescript
// Frontend sends
iframe.contentWindow?.postMessage({
  action: string,
  params: object
}, VIEWER_ORIGIN)

// Layout Service responds
window.postMessage({
  action: string,
  success: boolean,
  data?: object,
  error?: string
}, FRONTEND_ORIGIN)
```

### Error Handling

Expected error responses:

```typescript
{
  action: 'commandName',
  success: false,
  error: 'Error message describing what went wrong'
}
```

Common error scenarios:
- Invalid parameters
- No selection when required
- Slide index out of bounds
- Element not found
- Permission denied (read-only mode)

---

## Contact

For questions about these requirements, contact the frontend team.

**Last Updated**: 2024-11-30
**Version**: 1.0
