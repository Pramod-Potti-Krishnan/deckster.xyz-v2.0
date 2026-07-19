import type { ChartData, ChartDataSourceMode, TextLabsChartType } from '@/types/textlabs'

export type ChartDataValidationResult =
  | { valid: true; data: ChartData }
  | { valid: false; error: string }

export type CustomChartAxisLabels = {
  requiresAxes: boolean
  xAxisLabel: string | null
  yAxisLabel: string | null
  error: string | null
}

const GENERIC_AXIS_LABELS = new Set([
  'axis',
  'value',
  'values',
  'x',
  'x axis',
  'x axis value',
  'x label',
  'x value',
  'x variable',
  'y',
  'y axis',
  'y axis value',
  'y label',
  'y value',
  'y variable',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonEmptyLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Validate the three canonical data shapes shared by Researcher and Analytics. */
export function validateChartData(value: unknown): ChartDataValidationResult {
  if (Array.isArray(value)) {
    if (value.length < 2) {
      return { valid: false, error: 'Custom data must contain at least two data points.' }
    }
    if (!value.every(isRecord)) {
      return { valid: false, error: 'Every data point must be a JSON object.' }
    }

    const isSimple = value.every(point => nonEmptyLabel(point.label) && isFiniteNumber(point.value))
    if (isSimple) return { valid: true, data: value as ChartData }

    const hasRadius = value.some(point => Object.prototype.hasOwnProperty.call(point, 'r'))
    const isScatterBubble = value.every(point => (
      isFiniteNumber(point.x) &&
      isFiniteNumber(point.y) &&
      (point.label === undefined || nonEmptyLabel(point.label)) &&
      (!hasRadius || (isFiniteNumber(point.r) && point.r > 0))
    ))
    if (isScatterBubble) return { valid: true, data: value as ChartData }

    return {
      valid: false,
      error: hasRadius
        ? 'Bubble data requires finite x/y values and a positive radius (r) for every point.'
        : 'Use label/value objects for category data or finite x/y objects for scatter data.',
    }
  }

  if (isRecord(value)) {
    const labels = value.labels
    const datasets = value.datasets
    if (!Array.isArray(labels) || labels.length < 2 || !labels.every(nonEmptyLabel)) {
      return { valid: false, error: 'Multi-series data requires at least two non-empty labels.' }
    }
    if (!Array.isArray(datasets) || datasets.length === 0 || !datasets.every(isRecord)) {
      return { valid: false, error: 'Multi-series data requires at least one dataset.' }
    }
    const datasetsValid = datasets.every(dataset => (
      nonEmptyLabel(dataset.label) &&
      Array.isArray(dataset.data) &&
      dataset.data.length === labels.length &&
      dataset.data.every(isFiniteNumber)
    ))
    if (!datasetsValid) {
      return {
        valid: false,
        error: 'Each dataset needs a name and finite numeric data matching the labels length.',
      }
    }
    return { valid: true, data: value as unknown as ChartData }
  }

  return {
    valid: false,
    error: 'Data must be a label/value array, an x/y array, or a labels/datasets object.',
  }
}

export function parseChartDataJson(json: string): ChartDataValidationResult {
  if (!json.trim()) return { valid: false, error: 'Enter custom chart data before generating.' }
  try {
    return validateChartData(JSON.parse(json))
  } catch {
    return { valid: false, error: 'Custom data is not valid JSON.' }
  }
}

export function chartDataRequiresAxes(data: ChartData | null): boolean {
  return Boolean(
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(point => (
      typeof point === 'object' &&
      point !== null &&
      'x' in point &&
      'y' in point
    )),
  )
}

/**
 * Raw x/y(/r) values do not carry domain semantics. Require the user to name
 * both axes rather than persisting UI placeholders as chart metadata.
 */
export function resolveCustomChartAxisLabels(
  data: ChartData | null,
  xAxisLabel: string,
  yAxisLabel: string,
): CustomChartAxisLabels {
  const requiresAxes = chartDataRequiresAxes(data)
  if (!requiresAxes) {
    return {
      requiresAxes: false,
      xAxisLabel: null,
      yAxisLabel: null,
      error: null,
    }
  }

  const resolvedX = xAxisLabel.trim()
  const resolvedY = yAxisLabel.trim()
  const normalizedX = resolvedX.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const normalizedY = resolvedY.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const comparableX = resolvedX.toLowerCase().replace(/\s+/g, ' ')
  const comparableY = resolvedY.toLowerCase().replace(/\s+/g, ' ')
  const missing = !resolvedX || !resolvedY
  const generic = GENERIC_AXIS_LABELS.has(normalizedX) || GENERIC_AXIS_LABELS.has(normalizedY)
  const duplicates = !missing && comparableX === comparableY

  let error: string | null = null
  if (missing) {
    error = 'Scatter and bubble data require meaningful X-axis and Y-axis labels (for example, Investment and Revenue).'
  } else if (generic) {
    error = 'Use meaningful axis labels instead of generic labels such as “X value” or “Y value”.'
  } else if (duplicates) {
    error = 'Scatter and bubble data require distinct X-axis and Y-axis labels.'
  }

  return {
    requiresAxes: true,
    xAxisLabel: resolvedX || null,
    yAxisLabel: resolvedY || null,
    error,
  }
}

/**
 * Axis fields are owned by Custom JSON x/y(/r) data only. Auto and
 * Illustrative charts must leave them empty so researched/source metadata can
 * provide the semantics downstream.
 */
export function resolveChartSubmissionAxisLabels(
  dataSource: ChartDataSourceMode,
  data: ChartData | null,
  xAxisLabel: string,
  yAxisLabel: string,
): CustomChartAxisLabels {
  if (dataSource !== 'custom') {
    return {
      requiresAxes: false,
      xAxisLabel: null,
      yAxisLabel: null,
      error: null,
    }
  }
  return resolveCustomChartAxisLabels(data, xAxisLabel, yAxisLabel)
}

export function chartDataTemplate(chartType: TextLabsChartType): string {
  if (chartType === 'scatter') {
    return '[\n  { "label": "Point 1", "x": 10, "y": 20 },\n  { "label": "Point 2", "x": 30, "y": 40 }\n]'
  }
  if (chartType === 'bubble') {
    return '[\n  { "label": "Item 1", "x": 10, "y": 20, "r": 5 },\n  { "label": "Item 2", "x": 30, "y": 40, "r": 10 }\n]'
  }
  if (['bar_grouped', 'bar_stacked', 'area_stacked'].includes(chartType)) {
    return '{\n  "labels": ["Q1", "Q2", "Q3"],\n  "datasets": [\n    { "label": "Revenue", "data": [100, 125, 150] },\n    { "label": "Costs", "data": [65, 70, 82] }\n  ]\n}'
  }
  return '[\n  { "label": "Category A", "value": 30 },\n  { "label": "Category B", "value": 45 },\n  { "label": "Category C", "value": 25 }\n]'
}

export function researchedChartRecoveryMessage(reason?: string | null): string {
  const explanation = reason?.trim() ? `${reason.trim()} ` : ''
  return `${explanation}Research could not produce valid chart data. Refine the prompt or choose Data Source → Illustrative to generate clearly labeled sample data.`
}
