# AI Service: Chart

This document specifies the Chart AI Service requirements for generating data visualizations within presentations. The service uses AI to generate chart data and configurations compatible with Chart.js.

---

## Service Overview

The Chart Service generates 8 types of data visualizations:

| Type | Description | Best For |
|------|-------------|----------|
| `bar` | Vertical bar chart | Comparing categories |
| `line` | Line chart | Trends over time |
| `pie` | Pie chart | Part-to-whole relationships |
| `doughnut` | Doughnut chart | Part-to-whole with center content |
| `area` | Area chart | Volume trends over time |
| `scatter` | Scatter plot | Correlation analysis |
| `radar` | Radar/spider chart | Multi-variable comparison |
| `polarArea` | Polar area chart | Cyclic data comparison |

---

## Service Endpoints

### Base URL
```
POST /api/ai/chart/*
```

---

## Chart Generation

### 1. Generate Chart Data

```
POST /api/ai/chart/generate
```

#### Request Schema

```typescript
interface ChartGenerateRequest {
  // Required
  prompt: string                    // Description of chart data
  chartType: ChartType              // One of 8 types
  presentationId: string
  slideId: string
  elementId: string

  // Context
  context: {
    presentationTitle: string
    slideTitle?: string
    slideIndex: number
    industry?: string               // For realistic data generation
    timeFrame?: string              // "Q1 2024", "2020-2024"
  }

  // Element constraints
  constraints: {
    gridWidth: number               // Element width in grid units (1-12)
    gridHeight: number              // Element height in grid units (1-8)
  }

  // Chart configuration
  config?: {
    dataPoints?: number             // Number of data points
    datasets?: number               // Number of series
    animated?: boolean              // Enable animations
    aspectRatio?: number            // Width/height ratio
  }

  // Style options
  style?: {
    palette: ChartPalette           // Color scheme
    customColors?: string[]         // Override palette colors
    showLegend?: boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    showGrid?: boolean
    showDataLabels?: boolean
  }

  // Axis configuration
  axes?: {
    xLabel?: string
    yLabel?: string
    xType?: 'category' | 'time' | 'linear'
    yMin?: number
    yMax?: number
    stacked?: boolean
  }
}

type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'doughnut'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'polarArea'

type ChartPalette =
  | 'default'       // Standard blue-green-yellow-red
  | 'professional'  // Corporate blues and grays
  | 'vibrant'       // Bold, saturated colors
  | 'pastel'        // Soft, muted colors
  | 'monochrome'    // Single color variations
  | 'sequential'    // Light to dark gradient
  | 'diverging'     // Two-color gradient
  | 'categorical'   // Distinct category colors
```

#### Response Schema

```typescript
interface ChartGenerateResponse {
  success: boolean
  data?: {
    generationId: string

    // Chart.js configuration
    chartConfig: ChartConfiguration

    // Raw data
    rawData: {
      labels: string[]
      datasets: DatasetData[]
    }

    // Rendered preview (optional)
    preview?: {
      png: string                   // Base64 PNG thumbnail
    }

    // Metadata
    metadata: {
      chartType: ChartType
      dataPointCount: number
      datasetCount: number
      suggestedTitle: string
      dataRange: {
        min: number
        max: number
        average: number
      }
    }

    // Analysis
    insights?: {
      trend?: 'increasing' | 'decreasing' | 'stable' | 'volatile'
      outliers?: number[]           // Indices of outlier points
      highlights?: string[]         // Notable observations
    }
  }
  error?: {
    code: ChartErrorCode
    message: string
    retryable: boolean
  }
}

type ChartErrorCode =
  | 'INVALID_TYPE'
  | 'INVALID_PROMPT'
  | 'GENERATION_FAILED'
  | 'DATA_INCONSISTENT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
```

---

## Chart.js Configuration

### Complete Configuration Structure

```typescript
interface ChartConfiguration {
  type: ChartType
  data: ChartData
  options: ChartOptions
  plugins?: ChartPlugin[]
}

interface ChartData {
  labels: string[]
  datasets: Dataset[]
}

interface Dataset {
  label: string
  data: number[] | ScatterDataPoint[]
  backgroundColor: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
  fill?: boolean | string
  tension?: number                  // Line curve (0-1)
  pointRadius?: number
  pointHoverRadius?: number
  hoverOffset?: number              // For pie/doughnut
  stack?: string                    // For stacked charts
}

interface ScatterDataPoint {
  x: number
  y: number
}

interface ChartOptions {
  responsive: boolean
  maintainAspectRatio: boolean
  aspectRatio?: number

  plugins: {
    legend: LegendOptions
    title: TitleOptions
    tooltip: TooltipOptions
    datalabels?: DataLabelOptions
  }

  scales?: {
    x?: ScaleOptions
    y?: ScaleOptions
  }

  animation?: AnimationOptions
}

interface LegendOptions {
  display: boolean
  position: 'top' | 'bottom' | 'left' | 'right'
  labels?: {
    color?: string
    font?: FontOptions
    padding?: number
    usePointStyle?: boolean
  }
}

interface TitleOptions {
  display: boolean
  text: string
  color?: string
  font?: FontOptions
  padding?: number
}

interface TooltipOptions {
  enabled: boolean
  mode?: 'point' | 'index' | 'nearest'
  intersect?: boolean
  callbacks?: {
    label?: (context: any) => string
    title?: (context: any) => string
  }
}

interface ScaleOptions {
  display: boolean
  title?: {
    display: boolean
    text: string
    color?: string
    font?: FontOptions
  }
  grid?: {
    display: boolean
    color?: string
  }
  ticks?: {
    color?: string
    font?: FontOptions
  }
  stacked?: boolean
  min?: number
  max?: number
  type?: 'category' | 'linear' | 'time' | 'logarithmic'
}

interface FontOptions {
  family?: string
  size?: number
  weight?: string | number
}

interface AnimationOptions {
  duration?: number
  easing?: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' |
           'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' |
           'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'
}
```

---

## Color Palettes

### Palette Definitions

```typescript
const CHART_PALETTES: Record<ChartPalette, string[]> = {
  default: [
    '#3B82F6',  // Blue
    '#10B981',  // Green
    '#F59E0B',  // Yellow
    '#EF4444',  // Red
    '#8B5CF6',  // Purple
    '#EC4899',  // Pink
    '#06B6D4',  // Cyan
    '#F97316'   // Orange
  ],

  professional: [
    '#1E40AF',  // Dark Blue
    '#166534',  // Dark Green
    '#B45309',  // Dark Yellow
    '#991B1B',  // Dark Red
    '#5B21B6',  // Dark Purple
    '#9D174D',  // Dark Pink
    '#0E7490',  // Dark Cyan
    '#C2410C'   // Dark Orange
  ],

  vibrant: [
    '#2563EB',  // Bright Blue
    '#059669',  // Bright Green
    '#D97706',  // Bright Yellow
    '#DC2626',  // Bright Red
    '#7C3AED',  // Bright Purple
    '#DB2777',  // Bright Pink
    '#0891B2',  // Bright Cyan
    '#EA580C'   // Bright Orange
  ],

  pastel: [
    '#93C5FD',  // Light Blue
    '#86EFAC',  // Light Green
    '#FCD34D',  // Light Yellow
    '#FCA5A5',  // Light Red
    '#C4B5FD',  // Light Purple
    '#F9A8D4',  // Light Pink
    '#67E8F9',  // Light Cyan
    '#FDBA74'   // Light Orange
  ],

  monochrome: [
    '#1F2937',  // Gray 800
    '#374151',  // Gray 700
    '#4B5563',  // Gray 600
    '#6B7280',  // Gray 500
    '#9CA3AF',  // Gray 400
    '#D1D5DB',  // Gray 300
    '#E5E7EB',  // Gray 200
    '#F3F4F6'   // Gray 100
  ],

  sequential: [
    '#EFF6FF',  // Blue 50
    '#DBEAFE',  // Blue 100
    '#BFDBFE',  // Blue 200
    '#93C5FD',  // Blue 300
    '#60A5FA',  // Blue 400
    '#3B82F6',  // Blue 500
    '#2563EB',  // Blue 600
    '#1D4ED8'   // Blue 700
  ],

  diverging: [
    '#DC2626',  // Red
    '#F87171',  // Red Light
    '#FCA5A5',  // Red Lighter
    '#FEE2E2',  // Red Lightest
    '#DCFCE7',  // Green Lightest
    '#86EFAC',  // Green Lighter
    '#4ADE80',  // Green Light
    '#22C55E'   // Green
  ],

  categorical: [
    '#0088FE',  // Blue
    '#00C49F',  // Teal
    '#FFBB28',  // Yellow
    '#FF8042',  // Orange
    '#8884D8',  // Purple
    '#82CA9D',  // Green
    '#FFC0CB',  // Pink
    '#A4DE6C'   // Lime
  ]
}

// Get colors for chart
function getChartColors(
  palette: ChartPalette,
  count: number,
  customColors?: string[]
): string[] {
  if (customColors && customColors.length >= count) {
    return customColors.slice(0, count)
  }

  const colors = CHART_PALETTES[palette]

  // If need more colors than palette has, interpolate
  if (count > colors.length) {
    return interpolateColors(colors, count)
  }

  return colors.slice(0, count)
}
```

---

## Chart Type Configurations

### Bar Chart

```typescript
interface BarChartConfig {
  indexAxis?: 'x' | 'y'             // 'y' for horizontal bars
  barThickness?: number | 'flex'
  maxBarThickness?: number
  barPercentage?: number            // 0-1, bar width relative to category
  categoryPercentage?: number       // 0-1, category width
  grouped?: boolean                 // Group multi-dataset bars
  stacked?: boolean                 // Stack bars
}

const BAR_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'bar',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: true } }
    }
  }
}
```

### Line Chart

```typescript
interface LineChartConfig {
  tension?: number                  // Curve tension (0 = straight, 1 = very curved)
  fill?: boolean | 'origin' | 'start' | 'end'
  stepped?: boolean | 'before' | 'after' | 'middle'
  pointStyle?: 'circle' | 'cross' | 'dash' | 'rect' | 'star' | 'triangle'
  pointRadius?: number
  showLine?: boolean
}

const LINE_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'line',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: true }, beginAtZero: false }
    },
    elements: {
      line: { tension: 0.3 },
      point: { radius: 4, hoverRadius: 6 }
    }
  }
}
```

### Pie/Doughnut Chart

```typescript
interface PieChartConfig {
  cutout?: string | number          // Inner radius ('50%' for doughnut)
  rotation?: number                 // Starting angle in degrees
  circumference?: number            // Arc circumference (360 = full circle)
  hoverOffset?: number              // Slice offset on hover
}

const PIE_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'pie',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed}%`
        }
      }
    }
  }
}

const DOUGHNUT_DEFAULTS: Partial<ChartConfiguration> = {
  ...PIE_DEFAULTS,
  type: 'doughnut',
  options: {
    ...PIE_DEFAULTS.options,
    cutout: '50%'
  }
}
```

### Area Chart

```typescript
const AREA_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'line',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' },
      filler: { propagate: false }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: true }, stacked: true }
    },
    elements: {
      line: { tension: 0.3 }
    }
  }
}

// Area charts use fill: true on datasets
function createAreaDataset(
  label: string,
  data: number[],
  color: string
): Dataset {
  return {
    label,
    data,
    backgroundColor: `${color}40`, // 25% opacity
    borderColor: color,
    fill: true
  }
}
```

### Scatter Chart

```typescript
interface ScatterChartConfig {
  pointRadius?: number
  pointStyle?: string
  showLine?: boolean                // Connect points with lines
}

const SCATTER_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'scatter',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        grid: { display: true }
      },
      y: {
        type: 'linear',
        grid: { display: true }
      }
    },
    elements: {
      point: { radius: 6, hoverRadius: 8 }
    }
  }
}
```

### Radar Chart

```typescript
interface RadarChartConfig {
  angleLines?: {
    display: boolean
    color?: string
  }
  suggestedMin?: number
  suggestedMax?: number
}

const RADAR_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'radar',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      r: {
        angleLines: { display: true },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    elements: {
      line: { borderWidth: 2 },
      point: { radius: 3, hoverRadius: 5 }
    }
  }
}
```

### Polar Area Chart

```typescript
const POLAR_DEFAULTS: Partial<ChartConfiguration> = {
  type: 'polarArea',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' }
    },
    scales: {
      r: {
        ticks: { display: false },
        grid: { color: '#E5E7EB' }
      }
    }
  }
}
```

---

## Data Generation Guidelines

### Data Point Limits by Size

```typescript
const DATA_LIMITS = {
  bar: {
    small: { maxPoints: 4, maxDatasets: 2 },
    medium: { maxPoints: 8, maxDatasets: 3 },
    large: { maxPoints: 15, maxDatasets: 5 }
  },
  line: {
    small: { maxPoints: 6, maxDatasets: 2 },
    medium: { maxPoints: 12, maxDatasets: 3 },
    large: { maxPoints: 24, maxDatasets: 4 }
  },
  pie: {
    small: { maxSlices: 4 },
    medium: { maxSlices: 6 },
    large: { maxSlices: 8 }
  },
  doughnut: {
    small: { maxSlices: 4 },
    medium: { maxSlices: 6 },
    large: { maxSlices: 8 }
  },
  area: {
    small: { maxPoints: 6, maxDatasets: 2 },
    medium: { maxPoints: 12, maxDatasets: 3 },
    large: { maxPoints: 24, maxDatasets: 4 }
  },
  scatter: {
    small: { maxPoints: 20, maxDatasets: 2 },
    medium: { maxPoints: 50, maxDatasets: 3 },
    large: { maxPoints: 100, maxDatasets: 4 }
  },
  radar: {
    small: { maxAxes: 5, maxDatasets: 2 },
    medium: { maxAxes: 8, maxDatasets: 3 },
    large: { maxAxes: 10, maxDatasets: 4 }
  },
  polarArea: {
    small: { maxSlices: 4 },
    medium: { maxSlices: 6 },
    large: { maxSlices: 8 }
  }
}

function getDataLimits(
  chartType: ChartType,
  gridWidth: number,
  gridHeight: number
): { maxPoints: number, maxDatasets: number } {
  const size = getLayoutSize(gridWidth, gridHeight)
  const limits = DATA_LIMITS[chartType][size]

  return {
    maxPoints: limits.maxPoints || limits.maxSlices || limits.maxAxes || 10,
    maxDatasets: limits.maxDatasets || 1
  }
}

function getLayoutSize(
  gridWidth: number,
  gridHeight: number
): 'small' | 'medium' | 'large' {
  const area = gridWidth * gridHeight

  if (area <= 16) return 'small'
  if (area <= 48) return 'medium'
  return 'large'
}
```

### Realistic Data Generation

```typescript
// Generate realistic data based on industry/context
interface DataGenerationContext {
  industry?: string
  metric?: string
  timeFrame?: string
  trend?: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  seasonality?: boolean
}

// Common industry metrics with typical ranges
const INDUSTRY_METRICS = {
  technology: {
    'monthly_users': { min: 10000, max: 10000000, growth: 0.1 },
    'revenue': { min: 100000, max: 50000000, growth: 0.15 },
    'conversion_rate': { min: 1, max: 10, growth: 0.02 }
  },
  retail: {
    'monthly_sales': { min: 50000, max: 5000000, growth: 0.05 },
    'average_order': { min: 25, max: 200, growth: 0.03 },
    'customer_count': { min: 1000, max: 100000, growth: 0.08 }
  },
  finance: {
    'portfolio_value': { min: 100000, max: 10000000, growth: 0.07 },
    'transaction_volume': { min: 1000, max: 100000, growth: 0.1 },
    'roi': { min: -20, max: 40, growth: 0 }
  },
  healthcare: {
    'patient_visits': { min: 100, max: 10000, growth: 0.03 },
    'satisfaction_score': { min: 60, max: 100, growth: 0.01 },
    'wait_time': { min: 5, max: 60, growth: -0.02 }
  }
}
```

---

## Transform Operations

### 2. Change Chart Type

```
POST /api/ai/chart/change-type
```

#### Request Schema

```typescript
interface ChangeChartTypeRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  newType: ChartType
  preserveData: boolean             // Keep existing data
  adaptOptions: boolean             // Adjust options for new type
}
```

### 3. Update Chart Data

```
POST /api/ai/chart/update-data
```

#### Request Schema

```typescript
interface UpdateChartDataRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  updates: {
    labels?: string[]
    datasets?: {
      index: number
      data?: number[]
      label?: string
      colors?: string[]
    }[]
    addDataset?: {
      label: string
      data: number[]
    }
    removeDataset?: number          // Index to remove
  }
}
```

### 4. Update Chart Style

```
POST /api/ai/chart/update-style
```

#### Request Schema

```typescript
interface UpdateChartStyleRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  style: {
    palette?: ChartPalette
    customColors?: string[]
    showLegend?: boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    showGrid?: boolean
    showDataLabels?: boolean
    animated?: boolean
  }
}
```

### 5. Regenerate Chart Data

```
POST /api/ai/chart/regenerate
```

#### Request Schema

```typescript
interface RegenerateChartRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string

  preserve: {
    type: boolean                   // Keep chart type
    labels: boolean                 // Keep x-axis labels
    structure: boolean              // Keep dataset count
    style: boolean                  // Keep styling
  }

  modifications?: string            // Additional instructions
}
```

---

## Client-Side Rendering

### Chart.js Integration

The Layout Service renders charts client-side using Chart.js:

```typescript
import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

// Register all components
Chart.register(...registerables, ChartDataLabels)

async function renderChart(
  config: ChartConfiguration,
  container: HTMLCanvasElement
): Promise<Chart> {
  // Destroy existing chart if any
  const existingChart = Chart.getChart(container)
  if (existingChart) {
    existingChart.destroy()
  }

  // Create new chart
  return new Chart(container, config)
}

// Update chart data without recreating
function updateChartData(
  chart: Chart,
  newData: ChartData
): void {
  chart.data = newData
  chart.update('active')
}

// Update chart options
function updateChartOptions(
  chart: Chart,
  newOptions: Partial<ChartOptions>
): void {
  chart.options = { ...chart.options, ...newOptions }
  chart.update('active')
}
```

### Export to Image

```typescript
// Export chart as PNG
function exportChartPng(chart: Chart): string {
  return chart.toBase64Image('image/png', 1.0)
}

// Export chart as SVG (using custom renderer)
async function exportChartSvg(
  config: ChartConfiguration,
  width: number,
  height: number
): Promise<string> {
  // Use server-side rendering with canvas-to-svg
  // or puppeteer for accurate SVG export
}
```

---

## Error Handling

### Error Responses

```typescript
interface ChartError {
  code: ChartErrorCode
  message: string
  details?: {
    field?: string
    reason?: string
    suggestion?: string
  }
  retryable: boolean
}

const ERROR_EXAMPLES = {
  INVALID_TYPE: {
    code: 'INVALID_TYPE',
    message: 'Unknown chart type: "bubble"',
    details: {
      field: 'chartType',
      reason: 'Must be one of: bar, line, pie, doughnut, area, scatter, radar, polarArea',
      suggestion: 'Did you mean "scatter"?'
    },
    retryable: false
  },

  DATA_INCONSISTENT: {
    code: 'DATA_INCONSISTENT',
    message: 'Dataset lengths do not match labels',
    details: {
      field: 'data',
      reason: 'Found 5 labels but dataset has 7 values',
      suggestion: 'Ensure all datasets have the same length as labels array'
    },
    retryable: false
  }
}
```

---

## Rate Limiting

```typescript
const RATE_LIMITS = {
  generate: {
    requestsPerMinute: 20,
    requestsPerHour: 300
  },
  transform: {
    requestsPerMinute: 40,
    requestsPerHour: 600
  }
}
```

---

## Integration with Layout Service

### Orchestration Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  Layout Service  │────▶│   Chart AI       │
│   Panel      │     │  Orchestrator    │     │    Service       │
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                      │                        │
       │  1. Type selection   │                        │
       │  2. User prompt      │                        │
       │  3. Style options    │                        │
       │                      │  4. Add context        │
       │                      │  5. Calculate limits   │
       │                      │  6. Determine sizing   │
       │                      │                        │
       │                      │────────────────────────▶
       │                      │  7. Generate request   │
       │                      │                        │
       │                      │◀────────────────────────
       │                      │  8. Chart.js config   │
       │                      │                        │
       │◀─────────────────────│  9. Store config     │
       │ 10. Client render    │ 10. Return config    │
```

### Layout Service Responsibilities

1. **Store Configuration**: Save Chart.js config in element content
2. **Client-Side Rendering**: Use Chart.js to render canvas
3. **Handle Interactions**: Click events, tooltips, hover
4. **Resize Handling**: Responsive chart updates
5. **Export Support**: Generate images for PDF export
6. **Animation Control**: Enable/disable based on context

---

## Implementation Notes

### Chart.js Version

Target Chart.js version: `4.x`

Required plugins:
- `chartjs-plugin-datalabels` - Data labels on points
- `chartjs-adapter-date-fns` - Date axis support

### Performance Considerations

```typescript
// Optimization for large datasets
const PERFORMANCE_CONFIG = {
  // Disable animations for large datasets
  animationThreshold: 500,

  // Downsample data for display
  maxDisplayPoints: 100,

  // Lazy loading for offscreen charts
  intersectionObserverConfig: {
    root: null,
    rootMargin: '100px',
    threshold: 0.1
  }
}

function shouldAnimate(dataPointCount: number): boolean {
  return dataPointCount < PERFORMANCE_CONFIG.animationThreshold
}

function downsampleData(
  data: number[],
  targetPoints: number
): number[] {
  if (data.length <= targetPoints) return data

  const step = Math.ceil(data.length / targetPoints)
  return data.filter((_, i) => i % step === 0)
}
```

### Accessibility

```typescript
// Chart accessibility configuration
const ACCESSIBILITY_CONFIG = {
  // Alternative text for screen readers
  generateAltText(config: ChartConfiguration): string {
    const type = config.type
    const labels = config.data.labels?.join(', ')
    return `${type} chart showing ${labels}`
  },

  // Keyboard navigation
  enableKeyboardNavigation: true,

  // High contrast mode support
  highContrastPalette: [
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00'
  ]
}
```
