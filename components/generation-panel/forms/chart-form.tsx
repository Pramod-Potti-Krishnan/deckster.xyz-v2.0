'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChartConfig,
  ChartDataSourceMode,
  ChartFormData,
  ChartMetadataMode,
  TextLabsChartType,
  TextLabsPositionConfig,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import {
  buildChartPanelGenerationConfig,
  chartAxisInputMode,
  chartDataTemplate,
  parseChartDataJson,
  resolveChartPanelDraft,
  resolveChartSubmissionAxisLabels,
  resolveChartTitleOverride,
} from '@/lib/chart-data-contract'
import { ElementContext, GenerationPanelDraft, MandatoryConfig } from '../types'
import { resolveDraftThemeSource } from '@/lib/visual-form-draft'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PositionPresets } from '../shared/position-presets'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.CHART

export const CHART_TYPE_GROUPS: { group: string; types: { value: TextLabsChartType; label: string }[] }[] = [
  { group: 'Recommended', types: [{ value: 'auto', label: 'Auto' }] },
  {
    group: 'Basic',
    types: [
      { value: 'line', label: 'Line Chart' },
      { value: 'bar_vertical', label: 'Vertical Bar' },
      { value: 'bar_horizontal', label: 'Horizontal Bar' },
      { value: 'pie', label: 'Pie Chart' },
      { value: 'doughnut', label: 'Doughnut Chart' },
    ],
  },
  {
    group: 'Correlation',
    types: [
      { value: 'scatter', label: 'Scatter Plot' },
      { value: 'bubble', label: 'Bubble Chart' },
    ],
  },
  {
    group: 'Radial',
    types: [
      { value: 'polar_area', label: 'Polar Area' },
      { value: 'radar', label: 'Radar Chart' },
    ],
  },
  {
    group: 'Time Series',
    types: [
      { value: 'area', label: 'Area Chart' },
      { value: 'area_stacked', label: 'Stacked Area' },
    ],
  },
  {
    group: 'Comparison',
    types: [
      { value: 'bar_grouped', label: 'Grouped Bar' },
      { value: 'bar_stacked', label: 'Stacked Bar' },
    ],
  },
  {
    group: 'Financial',
    types: [
      { value: 'waterfall', label: 'Waterfall Chart' },
    ],
  },
]

const MULTI_SERIES_TYPES: TextLabsChartType[] = ['bar_grouped', 'bar_stacked', 'area_stacked']

interface ChartFormProps {
  onSubmit: (formData: ChartFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | null) => void
  initialDraft?: GenerationPanelDraft | null
  onDraftChange?: (draft: Partial<GenerationPanelDraft>) => void
}

export function ChartForm({
  onSubmit,
  registerSubmit,
  isGenerating,
  presentationId,
  elementContext,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  initialDraft,
  onDraftChange,
}: ChartFormProps) {
  const initialFormData = initialDraft?.formData?.componentType === 'CHART'
    ? initialDraft.formData
    : null
  const [initialState] = useState(() => resolveChartPanelDraft(initialFormData))
  const [preservedChartConfig] = useState(() => initialState.preservedChartConfig)
  const [chartType, setChartType] = useState<TextLabsChartType>(initialState.chartType)
  const [dataSource, setDataSource] = useState<ChartDataSourceMode>(initialState.dataSource)
  const [customDataInput, setCustomDataInput] = useState(initialState.customDataInput)
  const [dataError, setDataError] = useState<string | null>(null)
  const [titleMode, setTitleMode] = useState<ChartMetadataMode>(initialState.titleMode)
  const [chartTitle, setChartTitle] = useState(initialState.chartTitle)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [axisLabelMode, setAxisLabelMode] = useState<ChartMetadataMode>(initialState.axisLabelMode)
  const [axisError, setAxisError] = useState<string | null>(null)
  const [xAxisLabel, setXAxisLabel] = useState(initialState.xAxisLabel)
  const [yAxisLabel, setYAxisLabel] = useState(initialState.yAxisLabel)
  const [includeInsights, setIncludeInsights] = useState(initialState.includeInsights)
  const [seriesNamesInput, setSeriesNamesInput] = useState(initialState.seriesNamesInput)
  const [advancedModified, setAdvancedModified] = useState(initialState.advancedModified)
  const [zIndex, setZIndex] = useState(initialState.zIndex ?? DEFAULTS.zIndex)
  const [showOptions, setShowOptions] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(
    presentationId,
    initialFormData ? resolveDraftThemeSource(presentationId, initialFormData) : null,
  )

  // Auto follows the live placeholder geometry. Manual is an explicit user
  // override and is honored by the generation hook when selected.
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>(initialState.positionConfig ?? {
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: true,
  })
  const liveStartCol = elementContext?.startCol
  const liveStartRow = elementContext?.startRow
  const liveWidth = elementContext?.width
  const liveHeight = elementContext?.height

  useEffect(() => {
    if (
      liveStartCol === undefined
      || liveStartRow === undefined
      || liveWidth === undefined
      || liveHeight === undefined
    ) return
    setPositionConfig(previous => {
      if (!previous.auto_position) return previous
      if (
        previous.start_col === liveStartCol
        && previous.start_row === liveStartRow
        && previous.position_width === liveWidth
        && previous.position_height === liveHeight
      ) return previous
      return {
        start_col: liveStartCol,
        start_row: liveStartRow,
        position_width: liveWidth,
        position_height: liveHeight,
        auto_position: true,
      }
    })
  }, [liveHeight, liveStartCol, liveStartRow, liveWidth])

  const updatePositionConfig = useCallback((next: TextLabsPositionConfig) => {
    if (
      next.auto_position
      && liveStartCol !== undefined
      && liveStartRow !== undefined
      && liveWidth !== undefined
      && liveHeight !== undefined
    ) {
      setPositionConfig({
        start_col: liveStartCol,
        start_row: liveStartRow,
        position_width: liveWidth,
        position_height: liveHeight,
        auto_position: true,
      })
      return
    }
    setPositionConfig(next)
  }, [liveHeight, liveStartCol, liveStartRow, liveWidth])

  const parsedCustomData = useMemo(() => {
    if (!customDataInput.trim()) return null
    const validation = parseChartDataJson(customDataInput)
    return validation.valid ? validation.data : null
  }, [customDataInput])
  const axisInputMode = dataSource === 'custom'
    ? chartAxisInputMode(chartType, parsedCustomData)
    : chartAxisInputMode(chartType, null)
  const resolvedChartMetadata = initialState.resolvedChartMetadata

  const selectChartType = useCallback((nextChartType: TextLabsChartType) => {
    setChartType(nextChartType)
    setAdvancedModified(true)
    if (axisLabelMode === 'auto' || chartAxisInputMode(
      nextChartType,
      dataSource === 'custom' ? parsedCustomData : null,
    ) === 'hidden') {
      setAxisError(null)
      return
    }
    setAxisError(
      resolveChartSubmissionAxisLabels(
        'custom',
        nextChartType,
        parsedCustomData,
        xAxisLabel,
        yAxisLabel,
        'custom',
      ).error,
    )
  }, [axisLabelMode, dataSource, parsedCustomData, xAxisLabel, yAxisLabel])

  const chartTypeLabel = CHART_TYPE_GROUPS
    .flatMap(group => group.types)
    .find(type => type.value === chartType)?.label ?? 'Auto'

  // Keep chart choice in the chat toolbar, as in the production interaction
  // model. A native grouped select is used deliberately: it remains reliable
  // in the panel/iframe stack where the generic popover previously failed.
  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Chart Type',
      displayLabel: chartTypeLabel,
      selectedValue: chartType,
      promptPlaceholder: 'e.g., Show quarterly revenue growth for 2024',
      onChange: value => selectChartType(value as TextLabsChartType),
      customRender: (
        <label className="relative block min-w-0 max-w-[150px]">
          <span className="sr-only">Chart Type</span>
          <select
            aria-label="Chart Type"
            value={chartType}
            disabled={isGenerating}
            onChange={event => selectChartType(event.target.value as TextLabsChartType)}
            className="h-7 max-w-[150px] appearance-none rounded-lg border-0 bg-gray-100 py-1 pl-7 pr-7 text-xs font-medium text-gray-700 outline-none transition-colors hover:bg-gray-200 focus:ring-1 focus:ring-primary disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {CHART_TYPE_GROUPS.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.types.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-slate-400">
            ▾
          </span>
        </label>
      ),
    })
  }, [chartType, chartTypeLabel, isGenerating, registerMandatoryConfig, selectChartType])

  const seriesNames = useMemo(
    () => seriesNamesInput.split(',').map(value => value.trim()).filter(Boolean),
    [seriesNamesInput],
  )

  const buildChartFormData = useCallback((
    data: ChartConfig['data'],
    axes: ReturnType<typeof resolveChartSubmissionAxisLabels>,
    title: ReturnType<typeof resolveChartTitleOverride>,
  ): ChartFormData => {
    const effectiveAxisLabelMode = chartAxisInputMode(chartType, data) === 'hidden'
      ? 'auto'
      : axisLabelMode
    const baseFormData: ChartFormData = {
      componentType: 'CHART',
      prompt,
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      chartConfig: {
        ...preservedChartConfig,
        chart_type: chartType,
        requested_data_source_mode: dataSource,
        requested_title_mode: titleMode,
        requested_axis_label_mode: effectiveAxisLabelMode,
        include_insights: includeInsights,
        series_names: seriesNames,
        placeholder_mode: false,
        data,
        chart_title: title.chartTitle,
        x_axis_label: axes.xAxisLabel,
        y_axis_label: axes.yAxisLabel,
      },
      positionConfig,
    }
    return {
      ...baseFormData,
      // Layout persists this non-recursive snapshot so a later refine
      // activation can hydrate the chart panel after a reload.
      generationConfig: buildChartPanelGenerationConfig(
        baseFormData,
        customDataInput,
        showAdvanced,
      ),
    }
  }, [
    advancedModified,
    axisLabelMode,
    chartType,
    chartTitle,
    customDataInput,
    dataSource,
    includeInsights,
    positionConfig,
    preservedChartConfig,
    presentationId,
    prompt,
    seriesNames,
    showAdvanced,
    themeOverrides,
    titleMode,
    useDeckTheme,
    zIndex,
  ])

  const draftAxes = useMemo(
    () => resolveChartSubmissionAxisLabels(
      dataSource,
      chartType,
      dataSource === 'custom' ? parsedCustomData : null,
      xAxisLabel,
      yAxisLabel,
      axisLabelMode,
    ),
    [axisLabelMode, chartType, dataSource, parsedCustomData, xAxisLabel, yAxisLabel],
  )
  const draftTitle = useMemo(
    () => resolveChartTitleOverride(titleMode, chartTitle),
    [chartTitle, titleMode],
  )
  const draftFormData = useMemo(
    () => buildChartFormData(
      dataSource === 'custom' ? parsedCustomData : null,
      draftAxes,
      draftTitle,
    ),
    [buildChartFormData, dataSource, draftAxes, draftTitle, parsedCustomData],
  )

  useEffect(() => {
    onDraftChange?.({ formData: draftFormData })
  }, [draftFormData, onDraftChange])

  const handleSubmit = useCallback(() => {
    let data: ChartConfig['data'] = null
    if (dataSource === 'custom') {
      const validation = parseChartDataJson(customDataInput)
      if (!validation.valid) {
        setDataError(validation.error)
        return
      }
      data = validation.data
    }
    const axes = resolveChartSubmissionAxisLabels(
      dataSource,
      chartType,
      data,
      xAxisLabel,
      yAxisLabel,
      axisLabelMode,
    )
    if (axes.error) {
      setAxisError(axes.error)
      setShowOptions(true)
      return
    }
    const title = resolveChartTitleOverride(titleMode, chartTitle)
    if (title.error) {
      setTitleError(title.error)
      setShowOptions(true)
      return
    }
    setDataError(null)
    setAxisError(null)
    setTitleError(null)
    onSubmit(buildChartFormData(data, axes, title))
  }, [
    buildChartFormData,
    chartType,
    chartTitle,
    customDataInput,
    dataSource,
    onSubmit,
    axisLabelMode,
    titleMode,
    xAxisLabel,
    yAxisLabel,
  ])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  const validateInput = useCallback((value: string) => {
    setCustomDataInput(value)
    if (!value.trim()) {
      setDataError(null)
      setAxisError(null)
      return
    }
    const validation = parseChartDataJson(value)
    setDataError(validation.valid ? null : validation.error)
    if (!validation.valid) {
      setAxisError(null)
      return
    }
    setAxisError(
      resolveChartSubmissionAxisLabels(
        'custom',
        chartType,
        validation.data,
        xAxisLabel,
        yAxisLabel,
        axisLabelMode,
      ).error,
    )
  }, [axisLabelMode, chartType, xAxisLabel, yAxisLabel])

  const updateAxisLabels = useCallback((nextX: string, nextY: string) => {
    setXAxisLabel(nextX)
    setYAxisLabel(nextY)
    setAxisError(
      resolveChartSubmissionAxisLabels(
        dataSource,
        chartType,
        parsedCustomData,
        nextX,
        nextY,
        axisLabelMode,
      ).error,
    )
  }, [axisLabelMode, chartType, dataSource, parsedCustomData])

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <ToggleRow
          label="Data Source"
          field="dataSource"
          value={dataSource}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'illustrative', label: 'Illustrative' },
            { value: 'custom', label: 'Custom JSON' },
          ]}
          onChange={(_, value) => {
            const nextDataSource = value as ChartDataSourceMode
            setDataSource(nextDataSource)
            setDataError(null)
            // Axis state stays in the Custom silo so a temporary mode switch
            // is reversible. The independent Axis labels control decides
            // whether any override is submitted.
            setAxisError(
              axisLabelMode === 'custom'
                ? resolveChartSubmissionAxisLabels(
                    nextDataSource,
                    chartType,
                    nextDataSource === 'custom' ? parsedCustomData : null,
                    xAxisLabel,
                    yAxisLabel,
                    'custom',
                  ).error
                : null,
            )
            setAdvancedModified(true)
          }}
        />
        <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
          With Research on, Auto requires valid source-backed data. Illustrative creates clearly labeled sample data.
        </p>
      </div>

      {dataSource === 'custom' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="chart-custom-data" className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Custom Data (JSON)
            </label>
            <button
              type="button"
              onClick={() => validateInput(chartDataTemplate(chartType))}
              className="text-[10px] text-primary hover:text-primary/80"
            >
              Load Template
            </button>
          </div>
          <textarea
            id="chart-custom-data"
            value={customDataInput}
            onChange={event => validateInput(event.target.value)}
            rows={7}
            className={`w-full resize-y rounded-md border bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-800 dark:text-slate-100 ${
              dataError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
            }`}
            placeholder='[{ "label": "Jan", "value": 100 }]'
          />
          <p className={`text-[10px] leading-4 ${dataError ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
            {dataError || 'Accepts label/value, scatter/bubble x/y(/r), or labels/datasets data.'}
          </p>
        </div>
      )}

      {!showAdvanced && (titleError || axisError) && (
        <p role="alert" className="text-[10px] leading-4 text-red-500">
          {titleError || axisError} Open Advanced → Chart Options to update this setting.
        </p>
      )}

      {showAdvanced && (
        <CollapsibleSection title="Chart Options" isOpen={showOptions} onToggle={() => setShowOptions(value => !value)}>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <ToggleRow
                label="Chart heading"
                field="requested_title_mode"
                value={titleMode}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'custom', label: 'Custom' },
                ]}
                onChange={(_, value) => {
                  const nextMode = value as ChartMetadataMode
                  setTitleMode(nextMode)
                  setTitleError(resolveChartTitleOverride(nextMode, chartTitle).error)
                  setAdvancedModified(nextMode === 'custom' || advancedModified)
                }}
              />
              {titleMode === 'custom' ? (
                <div className="space-y-1">
                  <label htmlFor="chart-title" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    Heading
                  </label>
                  <input
                    id="chart-title"
                    value={chartTitle}
                    onChange={event => {
                      const value = event.target.value
                      setChartTitle(value)
                      setTitleError(resolveChartTitleOverride('custom', value).error)
                    }}
                    placeholder="e.g., Customer Acquisition Cost"
                    aria-invalid={Boolean(titleError)}
                    className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                      titleError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                  {titleError && (
                    <p role="alert" className="text-[10px] leading-4 text-red-500">{titleError}</p>
                  )}
                </div>
              ) : (
                <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                  {resolvedChartMetadata?.title
                    ? `Resolved heading: ${resolvedChartMetadata.title}`
                    : 'Auto derives a concise heading from the prompt and resolved data.'}
                </p>
              )}
            </div>

            {axisInputMode !== 'hidden' && (
              <div className="space-y-1.5">
                <ToggleRow
                  label="Axis labels"
                  field="requested_axis_label_mode"
                  value={axisLabelMode}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                  onChange={(_, value) => {
                    const nextMode = value as ChartMetadataMode
                    setAxisLabelMode(nextMode)
                    setAxisError(
                      nextMode === 'custom'
                        ? resolveChartSubmissionAxisLabels(
                            dataSource,
                            chartType,
                            dataSource === 'custom' ? parsedCustomData : null,
                            xAxisLabel,
                            yAxisLabel,
                            'custom',
                          ).error
                        : null,
                    )
                    setAdvancedModified(nextMode === 'custom' || advancedModified)
                  }}
                />
                {axisLabelMode === 'custom' ? (
                  <div className="space-y-1">
                    <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                      {axisInputMode === 'required'
                        ? 'Name what each numeric axis represents. Both labels are required for scatter and bubble data.'
                        : 'Name the category/time axis and measured value. Either label may be left blank.'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label htmlFor="chart-x-axis" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          X-axis label
                        </label>
                        <input
                          id="chart-x-axis"
                          value={xAxisLabel}
                          onChange={event => updateAxisLabels(event.target.value, yAxisLabel)}
                          placeholder="e.g., Investment"
                          aria-invalid={Boolean(axisError)}
                          className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                            axisError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="chart-y-axis" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          Y-axis label
                        </label>
                        <input
                          id="chart-y-axis"
                          value={yAxisLabel}
                          onChange={event => updateAxisLabels(xAxisLabel, event.target.value)}
                          placeholder="e.g., Revenue"
                          aria-invalid={Boolean(axisError)}
                          className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                            axisError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                          }`}
                        />
                      </div>
                    </div>
                    {axisError && (
                      <p role="alert" className="text-[10px] leading-4 text-red-500">{axisError}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                    {resolvedChartMetadata?.x_axis || resolvedChartMetadata?.y_axis
                      ? `Resolved axes: ${resolvedChartMetadata.x_axis || '—'} / ${resolvedChartMetadata.y_axis || '—'}`
                      : axisInputMode === 'required'
                        ? 'Auto derives meaningful axes from the prompt. Ambiguous scatter or bubble semantics return a recoverable error.'
                        : 'Auto derives axis meaning from the prompt and data.'}
                  </p>
                )}
              </div>
            )}

            <ThemeSourceSelector presentationId={presentationId} value={themeSource} onChange={updateThemeSource} />
            <ToggleRow
              label="Include Insights"
              field="include_insights"
              value={includeInsights ? 'true' : 'false'}
              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
              onChange={(_, value) => {
                setIncludeInsights(value === 'true')
                setAdvancedModified(true)
              }}
            />
            {MULTI_SERIES_TYPES.includes(chartType) && (
              <div className="space-y-1">
                <label htmlFor="chart-series-names" className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Series Names
                </label>
                <input
                  id="chart-series-names"
                  value={seriesNamesInput}
                  onChange={event => {
                    setSeriesNamesInput(event.target.value)
                    setAdvancedModified(true)
                  }}
                  placeholder="e.g., Revenue, Costs, Profit"
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {showAdvanced && (
        <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(value => !value)}>
          <div className="space-y-2.5">
            <PositionPresets
              positionConfig={positionConfig}
              onChange={updatePositionConfig}
              elementType="CHART"
              onAdvancedModified={() => setAdvancedModified(true)}
            />
            <ZIndexInput value={zIndex} onChange={setZIndex} onAdvancedModified={() => setAdvancedModified(true)} />
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

ChartForm.displayName = 'ChartForm'
