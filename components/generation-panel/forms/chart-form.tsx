'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChartConfig,
  ChartDataSourceMode,
  ChartFormData,
  TextLabsChartType,
  TextLabsPositionConfig,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import { chartDataTemplate, parseChartDataJson } from '@/lib/chart-data-contract'
import { ElementContext, MandatoryConfig } from '../types'
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
}: ChartFormProps) {
  const [chartType, setChartType] = useState<TextLabsChartType>('auto')
  const [dataSource, setDataSource] = useState<ChartDataSourceMode>('auto')
  const [customDataInput, setCustomDataInput] = useState('')
  const [dataError, setDataError] = useState<string | null>(null)
  const [xAxisLabel, setXAxisLabel] = useState('')
  const [yAxisLabel, setYAxisLabel] = useState('')
  const [includeInsights, setIncludeInsights] = useState(false)
  const [seriesNamesInput, setSeriesNamesInput] = useState('')
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const [showOptions, setShowOptions] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  // Auto follows the live placeholder geometry. Manual is an explicit user
  // override and is honored by the generation hook when selected.
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: true,
  })

  useEffect(() => {
    if (!elementContext) return
    setPositionConfig(previous => previous.auto_position ? {
      start_col: elementContext.startCol,
      start_row: elementContext.startRow,
      position_width: elementContext.width,
      position_height: elementContext.height,
      auto_position: true,
    } : previous)
  }, [elementContext])

  const updatePositionConfig = useCallback((next: TextLabsPositionConfig) => {
    if (next.auto_position && elementContext) {
      setPositionConfig({
        start_col: elementContext.startCol,
        start_row: elementContext.startRow,
        position_width: elementContext.width,
        position_height: elementContext.height,
        auto_position: true,
      })
      return
    }
    setPositionConfig(next)
  }, [elementContext])

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
      onChange: value => {
        setChartType(value as TextLabsChartType)
        setAdvancedModified(true)
      },
      customRender: (
        <label className="relative block min-w-0 max-w-[150px]">
          <span className="sr-only">Chart Type</span>
          <select
            aria-label="Chart Type"
            value={chartType}
            disabled={isGenerating}
            onChange={event => {
              setChartType(event.target.value as TextLabsChartType)
              setAdvancedModified(true)
            }}
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
  }, [chartType, chartTypeLabel, isGenerating, registerMandatoryConfig])

  const handleSubmit = useCallback(() => {
    let data: ChartConfig['data'] = null
    if (dataSource === 'custom') {
      const validation = parseChartDataJson(customDataInput)
      if (!validation.valid) {
        setDataError(validation.error)
        return
      }
      data = validation.data
      const requiresAxes = Array.isArray(data) && data.every(point => (
        typeof point === 'object' && point !== null && 'x' in point && 'y' in point
      ))
      if (requiresAxes && (
        !xAxisLabel.trim() ||
        !yAxisLabel.trim() ||
        xAxisLabel.trim().toLowerCase() === yAxisLabel.trim().toLowerCase()
      )) {
        setDataError('Scatter and bubble data require distinct X-axis and Y-axis labels.')
        return
      }
      setDataError(null)
    }

    const seriesNames = seriesNamesInput.split(',').map(value => value.trim()).filter(Boolean)
    onSubmit({
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
        chart_type: chartType,
        requested_data_source_mode: dataSource,
        include_insights: includeInsights,
        series_names: seriesNames,
        placeholder_mode: false,
        data,
        x_axis_label: xAxisLabel.trim() || null,
        y_axis_label: yAxisLabel.trim() || null,
      },
      positionConfig,
    })
  }, [
    advancedModified,
    chartType,
    customDataInput,
    dataSource,
    includeInsights,
    onSubmit,
    positionConfig,
    presentationId,
    prompt,
    seriesNamesInput,
    themeOverrides,
    useDeckTheme,
    xAxisLabel,
    yAxisLabel,
    zIndex,
  ])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  const validateInput = useCallback((value: string) => {
    setCustomDataInput(value)
    if (!value.trim()) {
      setDataError(null)
      return
    }
    const validation = parseChartDataJson(value)
    setDataError(validation.valid ? null : validation.error)
  }, [])

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
            setDataSource(value as ChartDataSourceMode)
            setDataError(null)
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
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <label htmlFor="chart-x-axis" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                X-axis label
              </label>
              <input
                id="chart-x-axis"
                value={xAxisLabel}
                onChange={event => setXAxisLabel(event.target.value)}
                placeholder="e.g., Investment"
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="chart-y-axis" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Y-axis label
              </label>
              <input
                id="chart-y-axis"
                value={yAxisLabel}
                onChange={event => setYAxisLabel(event.target.value)}
                placeholder="e.g., Revenue"
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {showAdvanced && (
        <CollapsibleSection title="Chart Options" isOpen={showOptions} onToggle={() => setShowOptions(value => !value)}>
          <div className="space-y-2.5">
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
