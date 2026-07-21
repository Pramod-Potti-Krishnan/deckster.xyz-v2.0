import type {
  ChartConfig,
  ChartData,
  ChartDataSourceMode,
  ChartDataUpdateMode,
  ChartFormData,
  ChartLegendMode,
  ChartMetadataMode,
  ResolvedChartMetadata,
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
export type ChartTitleOverride = {
  chartTitle: string | null
  error: string | null
}

export type ChartPanelDraftState = {
  chartType: TextLabsChartType
  dataSource: ChartDataSourceMode
  legendMode: ChartLegendMode
  customDataInput: string
  titleMode: ChartMetadataMode
  chartTitle: string
  axisLabelMode: ChartMetadataMode
  xAxisLabel: string
  yAxisLabel: string
  resolvedChartMetadata: ResolvedChartMetadata | null
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
const CHART_LEGEND_MODES = new Set<ChartLegendMode>(['auto', 'show', 'hide'])
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

function chartDataSourceMode(value: unknown): ChartDataSourceMode {
  if (typeof value === 'string' && CHART_DATA_SOURCE_MODES.has(value as ChartDataSourceMode)) {
    return value as ChartDataSourceMode
  }
  // Embedded data is not ownership evidence. Older generated, researched, and
  // illustrative charts all persisted their resolved dataset without a
  // requested mode, so treating data alone as Custom would silently change
  // provenance and regeneration behavior after a reload.
  return 'auto'
}

function chartMetadataMode(value: unknown): ChartMetadataMode {
  if (value === 'auto' || value === 'custom') return value
  // Older generated charts persisted their resolved title and axes without
  // ownership flags. Missing ownership must therefore remain Auto; only an
  // explicit modern requested_*_mode may claim a user override.
  return 'auto'
}

function chartLegendMode(value: unknown): ChartLegendMode {
  return typeof value === 'string' && CHART_LEGEND_MODES.has(value as ChartLegendMode)
    ? value as ChartLegendMode
    : 'auto'
}

/**
 * `data_update_mode` is an instruction for one Text Labs request, never chart
 * state. Strip it recursively before anything is cached by the panel or
 * persisted by Layout because services may echo the request at different
 * generationConfig/formData nesting levels.
 */
export function stripChartDataUpdateMode<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripChartDataUpdateMode(item)) as unknown as T
  }
  if (!isRecord(value)) return value

  const cleaned: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'data_update_mode' || key === 'dataUpdateMode') continue
    cleaned[key] = stripChartDataUpdateMode(nestedValue)
  }
  return cleaned as unknown as T
}

export type ResolveChartDataUpdateModeInput = {
  panelMode: 'generate' | 'edit' | 'refine'
  initialPrompt: string
  prompt: string
  initialChartType: TextLabsChartType
  chartType: TextLabsChartType
  initialDataSource: ChartDataSourceMode
  dataSource: ChartDataSourceMode
  initialCustomDataInput: string
  customDataInput: string
}

function comparableChartDataInput(input: string): string {
  try {
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize)
      if (!isRecord(value)) return value
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, normalize(value[key])]),
      )
    }
    return JSON.stringify(normalize(JSON.parse(input)))
  } catch {
    return input.trim()
  }
}

/**
 * Give Text Labs an unambiguous data-ownership hint only when the panel can
 * determine intent without interpreting natural language. A changed refine
 * prompt is intentionally left unclassified so Text Labs can distinguish
 * metadata-only wording from a new dataset request.
 */
export function resolveChartDataUpdateMode({
  panelMode,
  initialPrompt,
  prompt,
  initialChartType,
  chartType,
  initialDataSource,
  dataSource,
  initialCustomDataInput,
  customDataInput,
}: ResolveChartDataUpdateModeInput): ChartDataUpdateMode | undefined {
  if (panelMode !== 'refine') return 'replace'
  if (chartType !== initialChartType || dataSource !== initialDataSource) return 'replace'
  if (dataSource === 'custom') {
    return comparableChartDataInput(customDataInput) === comparableChartDataInput(initialCustomDataInput)
      ? 'preserve'
      : 'replace'
  }
  if (prompt.trim() !== initialPrompt.trim()) return undefined
  return 'preserve'
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function normalizeResolvedChartMetadata(value: unknown): ResolvedChartMetadata | null {
  if (!isRecord(value)) return null
  const title = cleanOptionalText(value.title)
  const xAxis = cleanOptionalText(value.x_axis)
  const yAxis = cleanOptionalText(value.y_axis)
  const metric = cleanOptionalText(value.metric)
  const unit = cleanOptionalText(value.unit)
  const valueFormat = cleanOptionalText(value.value_format)
  const hasSemanticValue = Boolean(title || xAxis || yAxis || metric || unit || valueFormat)
  const titleMode = value.title_mode === 'custom' ? 'custom' : 'auto'
  const axisLabelMode = value.axis_label_mode === 'custom' ? 'custom' : 'auto'
  const resolutionSources: ResolvedChartMetadata['resolution_source'][] = [
    'manual_override',
    'prompt_exact',
    'research',
    'deterministic',
    'llm',
    'fallback',
    'mixed',
  ]
  const resolutionSource = resolutionSources.includes(
    value.resolution_source as ResolvedChartMetadata['resolution_source'],
  )
    ? value.resolution_source as ResolvedChartMetadata['resolution_source']
    : 'fallback'
  const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence)
    ? Math.max(0, Math.min(1, value.confidence))
    : 0
  if (!hasSemanticValue && value.title_mode === undefined && value.axis_label_mode === undefined) {
    return null
  }

  return {
    title,
    x_axis: xAxis,
    y_axis: yAxis,
    metric,
    unit,
    value_format: valueFormat,
    title_mode: titleMode,
    axis_label_mode: axisLabelMode,
    resolution_source: resolutionSource,
    confidence,
  }
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
  return 'optional'
}

export function resolveChartTitleOverride(
  titleMode: ChartMetadataMode,
  chartTitle: string,
): ChartTitleOverride {
  if (titleMode === 'auto') return { chartTitle: null, error: null }
  const resolvedTitle = chartTitle.trim()
  return resolvedTitle
    ? { chartTitle: resolvedTitle, error: null }
    : { chartTitle: null, error: 'Enter a chart heading or switch Chart heading to Auto.' }
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
 * Resolve the independent Axis labels Auto/Custom control. With no explicit
 * mode argument, retain the legacy behavior: Custom JSON validates overrides,
 * while Auto/Illustrative leaves semantics to Text Labs.
 */
export function resolveChartSubmissionAxisLabels(
  dataSource: ChartDataSourceMode,
  chartType: TextLabsChartType,
  data: ChartData | null,
  xAxisLabel: string,
  yAxisLabel: string,
  axisLabelMode?: ChartMetadataMode,
): CustomChartAxisLabels {
  const effectiveMode = axisLabelMode ?? (dataSource === 'custom' ? 'custom' : 'auto')
  if (effectiveMode === 'auto' || NON_CARTESIAN_CHART_TYPES.has(chartType)) {
    return {
      requiresAxes: false,
      xAxisLabel: null,
      yAxisLabel: null,
      error: null,
    }
  }
  const resolved = resolveCustomChartAxisLabels(chartType, data, xAxisLabel, yAxisLabel)
  if (
    axisLabelMode === 'custom'
    && chartAxisInputMode(chartType, data) === 'optional'
    && !resolved.xAxisLabel
    && !resolved.yAxisLabel
  ) {
    return {
      ...resolved,
      error: 'Enter at least one meaningful axis label or switch Axis labels to Auto.',
    }
  }
  return resolved
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
  const resolvedChartMetadata = normalizeResolvedChartMetadata(
    generationMetadata?.resolved_chart_metadata
      ?? generationMetadata?.resolvedChartMetadata,
  )
  const chartTitle = typeof chartConfig.chart_title === 'string' ? chartConfig.chart_title : ''
  const xAxisLabel = typeof chartConfig.x_axis_label === 'string' ? chartConfig.x_axis_label : ''
  const yAxisLabel = typeof chartConfig.y_axis_label === 'string' ? chartConfig.y_axis_label : ''
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
    dataSource: chartDataSourceMode(chartConfig.requested_data_source_mode),
    legendMode: chartLegendMode(chartConfig.legend_mode),
    customDataInput,
    titleMode: chartMetadataMode(chartConfig.requested_title_mode),
    chartTitle,
    axisLabelMode: chartMetadataMode(chartConfig.requested_axis_label_mode),
    xAxisLabel,
    yAxisLabel,
    resolvedChartMetadata,
    includeInsights: chartConfig.include_insights === true,
    seriesNamesInput: Array.isArray(chartConfig.series_names)
      ? chartConfig.series_names.filter(nonEmptyLabel).join(', ')
      : '',
    advancedModified: formData?.advancedModified === true,
    zIndex: typeof formData?.z_index === 'number' && Number.isFinite(formData.z_index)
      ? formData.z_index
      : undefined,
    positionConfig: formData?.positionConfig,
    preservedChartConfig: stripChartDataUpdateMode({ ...chartConfig }),
  }
}

/**
 * Older Layout snapshots may contain a flat chart generation record rather
 * than the newer non-recursive `formData` snapshot. Synthesize only known
 * chart controls so those saved charts remain refinable without forwarding
 * arbitrary renderer metadata back as request options.
 */
export function resolveChartFormDataFromGenerationConfig(
  value: unknown,
): ChartFormData | null {
  if (!isRecord(value)) return null
  const nestedFormData = isRecord(value.formData) ? value.formData : null
  if (nestedFormData?.componentType === 'CHART') {
    return nestedFormData as unknown as ChartFormData
  }

  const nestedChartConfig = isRecord(value.chartConfig)
    ? value.chartConfig
    : isRecord(value.chart_config)
      ? value.chart_config
      : null
  const source = nestedChartConfig ?? value
  const rawData = source.data
  const validatedData = rawData === null || rawData === undefined
    ? null
    : validateChartData(rawData)
  const data = validatedData?.valid ? validatedData.data : null
  const chartTitle = cleanOptionalText(source.chart_title)
  const xAxisLabel = cleanOptionalText(source.x_axis_label)
  const yAxisLabel = cleanOptionalText(source.y_axis_label)
  const requestedTitleMode = chartMetadataMode(source.requested_title_mode)
  const requestedAxisLabelMode = chartMetadataMode(source.requested_axis_label_mode)
  const requestedDataSourceMode = chartDataSourceMode(source.requested_data_source_mode)
  const legendMode = chartLegendMode(source.legend_mode)
  const positionValue = isRecord(value.positionConfig)
    ? value.positionConfig
    : isRecord(value.position_config)
      ? value.position_config
      : null
  const positionConfig = positionValue
    && isFiniteNumber(positionValue.start_col)
    && isFiniteNumber(positionValue.start_row)
    && isFiniteNumber(positionValue.position_width)
    && isFiniteNumber(positionValue.position_height)
      ? {
          start_col: positionValue.start_col,
          start_row: positionValue.start_row,
          position_width: positionValue.position_width,
          position_height: positionValue.position_height,
          auto_position: positionValue.auto_position === true,
        }
      : undefined
  const colors = Array.isArray(source.colors)
    ? source.colors.filter(nonEmptyLabel)
    : undefined
  const colorMode = source.color_mode === 'multi'
    || source.color_mode === 'same'
    || source.color_mode === 'transparency'
      ? source.color_mode
      : undefined

  return {
    componentType: 'CHART',
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    count: isFiniteNumber(value.count) && value.count > 0 ? Math.floor(value.count) : 1,
    layout: value.layout === 'vertical' || value.layout === 'grid'
      ? value.layout
      : 'horizontal',
    advancedModified: value.advancedModified === true
      || value.advanced_modified === true
      || requestedTitleMode === 'custom'
      || requestedAxisLabelMode === 'custom'
      || legendMode !== 'auto',
    z_index: isFiniteNumber(value.zIndex)
      ? value.zIndex
      : isFiniteNumber(value.z_index)
        ? value.z_index
        : undefined,
    useDeckTheme: typeof value.useDeckTheme === 'boolean'
      ? value.useDeckTheme
      : typeof value.use_deck_theme === 'boolean'
        ? value.use_deck_theme
        : undefined,
    themeOverrides: isRecord(value.themeOverrides)
      ? value.themeOverrides
      : isRecord(value.theme_overrides)
        ? value.theme_overrides
        : undefined,
    chartConfig: {
      chart_type: textLabsChartType(source.chart_type ?? source.chartType),
      requested_data_source_mode: requestedDataSourceMode,
      requested_title_mode: requestedTitleMode,
      requested_axis_label_mode: requestedAxisLabelMode,
      legend_mode: legendMode,
      include_insights: source.include_insights === true,
      series_names: Array.isArray(source.series_names)
        ? source.series_names.filter(nonEmptyLabel)
        : [],
      placeholder_mode: false,
      data,
      chart_title: chartTitle,
      x_axis_label: xAxisLabel,
      y_axis_label: yAxisLabel,
      colors,
      color_mode: colorMode,
      chart_font: cleanOptionalText(source.chart_font),
    },
    positionConfig,
    generationConfig: value,
  }
}

/**
 * Combine Text Labs' renderer-owned generation details with the exact
 * user-owned chart-panel snapshot. Returned generator state wins generally;
 * the submitted form snapshot wins only for panel controls so Refine can
 * faithfully reopen after Layout persistence and a hard refresh.
 */
export function mergeChartPanelGenerationConfig(
  submittedConfig: unknown,
  returnedConfig: unknown,
  resolvedMetadata: unknown,
): Record<string, unknown> | null {
  const submitted = isRecord(submittedConfig) ? submittedConfig : null
  const returned = isRecord(returnedConfig) ? returnedConfig : null
  const submittedFormData = isRecord(submitted?.formData) ? submitted.formData : null
  const returnedFormData = isRecord(returned?.formData) ? returned.formData : null
  const isChartConfig = (
    submittedFormData?.componentType === 'CHART'
    || returnedFormData?.componentType === 'CHART'
    || submitted?.componentType === 'CHART'
    || returned?.componentType === 'CHART'
  )

  if (!isChartConfig) return returned ?? submitted

  const submittedChartConfig = isRecord(submittedFormData?.chartConfig)
    ? submittedFormData.chartConfig
    : null
  const returnedChartConfig = isRecord(returnedFormData?.chartConfig)
    ? returnedFormData.chartConfig
    : null
  const submittedPanelMetadata = isRecord(submittedFormData?.generationConfig)
    ? submittedFormData.generationConfig
    : null
  const returnedPanelMetadata = isRecord(returnedFormData?.generationConfig)
    ? returnedFormData.generationConfig
    : null
  const normalizedMetadata = normalizeResolvedChartMetadata(
    resolvedMetadata
      ?? returned?.resolved_chart_metadata
      ?? returned?.resolvedChartMetadata
      ?? submitted?.resolved_chart_metadata
      ?? submitted?.resolvedChartMetadata,
  )
  const merged: Record<string, unknown> = {
    ...(submitted ?? {}),
    ...(returned ?? {}),
  }

  if (normalizedMetadata) merged.resolved_chart_metadata = normalizedMetadata

  const mergedChartConfig: Record<string, unknown> | null = submittedChartConfig || returnedChartConfig
    ? {
        ...(returnedChartConfig ?? {}),
        ...(submittedChartConfig ?? {}),
      }
    : null
  if (mergedChartConfig) {
    const submittedChartType = textLabsChartType(
      submittedChartConfig?.chart_type ?? submittedChartConfig?.chartType,
    )
    const returnedChartType = textLabsChartType(
      returnedChartConfig?.chart_type
        ?? returnedChartConfig?.chartType
        ?? returned?.chart_type
        ?? returned?.chartType,
    )
    // Auto is durable panel ownership. A specific submitted type, however,
    // may just be the previous renderer snapshot while Text Labs classified a
    // changed natural-language refinement. Persist the effective returned type
    // so the next metadata-only refine cannot revert it.
    if (submittedChartType !== 'auto' && returnedChartType !== 'auto') {
      mergedChartConfig.chart_type = returnedChartType
    }

    const submittedLegendMode = chartLegendMode(
      submittedChartConfig?.legend_mode ?? submittedChartConfig?.legendMode,
    )
    const returnedLegendMode = chartLegendMode(
      returnedChartConfig?.legend_mode
        ?? returnedChartConfig?.legendMode
        ?? returned?.legend_mode
        ?? returned?.legendMode,
    )
    if (submittedLegendMode === 'auto' && returnedLegendMode !== 'auto') {
      mergedChartConfig.legend_mode = returnedLegendMode
    }

    const returnedPartToWholeContainer = [returnedChartConfig, returned]
      .find(container => Boolean(
        container && (
          Object.prototype.hasOwnProperty.call(container, 'part_to_whole_value_mode')
          || Object.prototype.hasOwnProperty.call(container, 'partToWholeValueMode')
        ),
      ))
    if (returnedPartToWholeContainer) {
      mergedChartConfig.part_to_whole_value_mode =
        returnedPartToWholeContainer.part_to_whole_value_mode
        ?? returnedPartToWholeContainer.partToWholeValueMode
        ?? null
    }
  }
  if (submittedFormData || returnedFormData) {
    merged.formData = {
      ...(returnedFormData ?? {}),
      ...(submittedFormData ?? {}),
      ...(mergedChartConfig ? {
        chartConfig: mergedChartConfig,
      } : {}),
      ...(submittedPanelMetadata || returnedPanelMetadata ? {
        generationConfig: {
          ...(returnedPanelMetadata ?? {}),
          ...(submittedPanelMetadata ?? {}),
          ...(normalizedMetadata ? { resolved_chart_metadata: normalizedMetadata } : {}),
        },
      } : {}),
    }
  }

  return stripChartDataUpdateMode(merged)
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
  return stripChartDataUpdateMode({
    ...panelMetadata,
    prompt: baseFormData.prompt,
    showAdvanced,
    formData: {
      ...baseFormData,
      generationConfig: panelMetadata,
    },
  })
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
  return stripChartDataUpdateMode({
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
  })
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
