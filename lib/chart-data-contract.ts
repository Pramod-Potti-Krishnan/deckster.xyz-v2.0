import type { ChartData, TextLabsChartType } from '@/types/textlabs'

export type ChartDataValidationResult =
  | { valid: true; data: ChartData }
  | { valid: false; error: string }

export type CustomChartAxisLabels = {
  requiresAxes: boolean
  xAxisLabel: string | null
  yAxisLabel: string | null
  error: string | null
}

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
 * Canonical user-provided x/y data is already meaningful data. Give its axes
 * neutral labels when the user did not name them; researched charts do not use
 * this custom-data helper and must still supply source-derived semantics.
 */
export function resolveCustomChartAxisLabels(
  data: ChartData | null,
  xAxisLabel: string,
  yAxisLabel: string,
): CustomChartAxisLabels {
  const requiresAxes = chartDataRequiresAxes(data)
  const resolvedX = xAxisLabel.trim() || (requiresAxes ? 'X value' : null)
  const resolvedY = yAxisLabel.trim() || (requiresAxes ? 'Y value' : null)
  const duplicates = requiresAxes &&
    resolvedX?.toLowerCase() === resolvedY?.toLowerCase()
  return {
    requiresAxes,
    xAxisLabel: resolvedX,
    yAxisLabel: resolvedY,
    error: duplicates
      ? 'Scatter and bubble data require distinct X-axis and Y-axis labels.'
      : null,
  }
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
