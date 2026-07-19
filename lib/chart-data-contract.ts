import type {
  ChartConfig,
  ChartData,
  ChartDataSourceMode,
  ChartFormData,
  TextLabsChartType,
  TextLabsPositionConfig,
} from '@/types/textlabs'

export type ChartDataValidationResult =
  | { valid: true; data: ChartData }
  | { valid: false; error: string }

export type CustomChartAxisLabels = {
  requiresAxes: boolean
  xAxisLabel: string | null
  yAxisLabel: string | null
  error: string | null
}

export type ChartAxisInputMode = 'hidden' | 'optional' | 'required'

export type ChartPanelDraftState = {
  chartType: TextLabsChartType
  dataSource: ChartDataSourceMode
  customDataInput: string
  xAxisLabel: string
  yAxisLabel: string
  includeInsights: boolean
  seriesNamesInput: string
  advancedModified: boolean
  zIndex: number | undefined
  positionConfig: TextLabsPositionConfig | undefined
  preservedChartConfig: Partial<ChartConfig>
}

export type ChartPanelGenerationConfig = {
  version: 1
  componentType: 'CHART'
  customDataInput: string
  prompt: string
  showAdvanced: boolean
  formData: ChartFormData
}

const CHART_TYPES = new Set<TextLabsChartType>([
  'auto',
  'line',
  'bar_vertical',
  'bar_horizontal',
  'pie',
  'doughnut',
  'scatter',
  'bubble',
  'radar',
  'polar_area',
  'area',
  'area_stacked',
  'bar_grouped',
  'bar_stacked',
  'waterfall',
])
const CHART_DATA_SOURCE_MODES = new Set<ChartDataSourceMode>(['auto', 'illustrative', 'custom'])
const NON_CARTESIAN_CHART_TYPES = new Set<TextLabsChartType>([
  'pie',
  'doughnut',
  'radar',
  'polar_area',
])
const REQUIRED_AXIS_CHART_TYPES = new Set<TextLabsChartType>(['scatter', 'bubble'])

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

function textLabsChartType(value: unknown): TextLabsChartType {
  return typeof value === 'string' && CHART_TYPES.has(value as TextLabsChartType)
    ? value as TextLabsChartType
    : 'auto'
}

function chartDataSourceMode(value: unknown, data: ChartData | null): ChartDataSourceMode {
  if (typeof value === 'string' && CHART_DATA_SOURCE_MODES.has(value as ChartDataSourceMode)) {
    return value as ChartDataSourceMode
  }
  return data ? 'custom' : 'auto'
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

export function chartAxisInputMode(
  chartType: TextLabsChartType,
  data: ChartData | null,
): ChartAxisInputMode {
  if (NON_CARTESIAN_CHART_TYPES.has(chartType)) return 'hidden'
  if (REQUIRED_AXIS_CHART_TYPES.has(chartType) || chartDataRequiresAxes(data)) return 'required'
  if (chartType !== 'auto' || data) return 'optional'
  return 'hidden'
}

/**
 * Validate axis labels according to the selected chart and canonical data
 * shape. Raw x/y(/r) charts require both semantics. Other Cartesian custom
 * charts allow either or both labels, while radial/part-to-whole charts do not
 * serialize Cartesian metadata.
 */
export function resolveCustomChartAxisLabels(
  chartType: TextLabsChartType,
  data: ChartData | null,
  xAxisLabel: string,
  yAxisLabel: string,
): CustomChartAxisLabels {
  const inputMode = chartAxisInputMode(chartType, data)
  if (inputMode === 'hidden') {
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
  const missingRequired = inputMode === 'required' && (!resolvedX || !resolvedY)
  const generic = Boolean(
    (resolvedX && GENERIC_AXIS_LABELS.has(normalizedX))
    || (resolvedY && GENERIC_AXIS_LABELS.has(normalizedY))
  )
  const duplicates = Boolean(resolvedX && resolvedY && comparableX === comparableY)

  let error: string | null = null
  if (missingRequired) {
    error = 'Scatter and bubble data require meaningful X-axis and Y-axis labels (for example, Investment and Revenue).'
  } else if (generic) {
    error = 'Use meaningful axis labels instead of generic labels such as “X value” or “Y value”.'
  } else if (duplicates) {
    error = inputMode === 'required'
      ? 'Scatter and bubble data require distinct X-axis and Y-axis labels.'
      : 'X-axis and Y-axis labels must be distinct.'
  }

  return {
    requiresAxes: inputMode === 'required',
    xAxisLabel: resolvedX || null,
    yAxisLabel: resolvedY || null,
    error,
  }
}

/**
 * Axis fields are owned only by Custom JSON. Auto and Illustrative charts must
 * leave them empty so researched/source metadata can provide the semantics
 * downstream.
 */
export function resolveChartSubmissionAxisLabels(
  dataSource: ChartDataSourceMode,
  chartType: TextLabsChartType,
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
  return resolveCustomChartAxisLabels(chartType, data, xAxisLabel, yAxisLabel)
}

/** Hydrate the chart form from the panel's remembered formData snapshot. */
export function resolveChartPanelDraft(
  formData: ChartFormData | null | undefined,
): ChartPanelDraftState {
  const chartConfig = formData?.chartConfig ?? {}
  const validatedData = chartConfig.data === null || chartConfig.data === undefined
    ? null
    : validateChartData(chartConfig.data)
  const data = validatedData && validatedData.valid ? validatedData.data : null
  const generationConfig = formData?.generationConfig
  const generationMetadata = isRecord(generationConfig) ? generationConfig : null
  const savedRawInput = generationMetadata?.customDataInput
  let customDataInput = typeof savedRawInput === 'string' ? savedRawInput : ''
  if (!customDataInput && data) {
    try {
      customDataInput = JSON.stringify(data, null, 2)
    } catch {
      customDataInput = ''
    }
  }

  return {
    chartType: textLabsChartType(chartConfig.chart_type),
    dataSource: chartDataSourceMode(chartConfig.requested_data_source_mode, data),
    customDataInput,
    xAxisLabel: typeof chartConfig.x_axis_label === 'string' ? chartConfig.x_axis_label : '',
    yAxisLabel: typeof chartConfig.y_axis_label === 'string' ? chartConfig.y_axis_label : '',
    includeInsights: chartConfig.include_insights === true,
    seriesNamesInput: Array.isArray(chartConfig.series_names)
      ? chartConfig.series_names.filter(nonEmptyLabel).join(', ')
      : '',
    advancedModified: formData?.advancedModified === true,
    zIndex: typeof formData?.z_index === 'number' && Number.isFinite(formData.z_index)
      ? formData.z_index
      : undefined,
    positionConfig: formData?.positionConfig,
    preservedChartConfig: { ...chartConfig },
  }
}

/**
 * Persist enough panel state to reopen a chart without recursively embedding
 * generationConfig.formData inside itself.
 */
export function buildChartPanelGenerationConfig(
  baseFormData: ChartFormData,
  customDataInput: string,
  showAdvanced: boolean,
): ChartPanelGenerationConfig {
  const panelMetadata = {
    version: 1 as const,
    componentType: 'CHART' as const,
    customDataInput,
  }
  return {
    ...panelMetadata,
    prompt: baseFormData.prompt,
    showAdvanced,
    formData: {
      ...baseFormData,
      generationConfig: panelMetadata,
    },
  }
}

/**
 * Generation preflight can replace theme and geometry fields after ChartForm
 * creates its reopen snapshot. Keep that nested snapshot aligned with the
 * authoritative request without copying transient slide/deck context into it.
 */
export function synchronizeChartPanelGenerationConfig(
  generationConfig: Record<string, unknown> | null | undefined,
  formData: ChartFormData,
): Record<string, unknown> | null | undefined {
  if (!isRecord(generationConfig)) return generationConfig
  const savedFormData = isRecord(generationConfig.formData)
    ? generationConfig.formData
    : null
  if (savedFormData?.componentType !== 'CHART') return generationConfig

  const savedPanelMetadata = isRecord(savedFormData.generationConfig)
    ? savedFormData.generationConfig
    : {
        version: 1,
        componentType: 'CHART',
        customDataInput: typeof generationConfig.customDataInput === 'string'
          ? generationConfig.customDataInput
          : '',
      }
  return {
    ...generationConfig,
    formData: {
      ...savedFormData,
      componentType: 'CHART',
      prompt: formData.prompt,
      count: formData.count,
      layout: formData.layout,
      advancedModified: formData.advancedModified,
      z_index: formData.z_index,
      presentationId: formData.presentationId,
      useDeckTheme: formData.useDeckTheme,
      themeOverrides: formData.themeOverrides,
      themeVariantId: formData.themeVariantId,
      themeBindings: formData.themeBindings,
      chartConfig: { ...formData.chartConfig },
      positionConfig: formData.positionConfig
        ? { ...formData.positionConfig }
        : undefined,
      // Keep the intentionally shallow panel metadata. Copying the outer
      // generationConfig here would recursively embed formData.
      generationConfig: savedPanelMetadata,
    },
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
