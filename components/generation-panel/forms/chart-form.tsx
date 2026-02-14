'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChartFormData, ChartConfig, TextLabsChartType, TextLabsPositionConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PositionPresets } from '../shared/position-presets'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.CHART

// Chart type groupings for the dropdown
const CHART_TYPE_GROUPS: { group: string; types: { value: TextLabsChartType; label: string }[] }[] = [
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
  {
    group: 'Treemap',
    types: [
      { value: 'treemap', label: 'Treemap' },
    ],
  },
]

// Chart types that support series names
const MULTI_SERIES_TYPES: TextLabsChartType[] = ['bar_grouped', 'bar_stacked', 'area_stacked', 'radar']

// Custom data templates per chart type
const DATA_TEMPLATES: Partial<Record<TextLabsChartType, string>> = {
  line: '[\n  { "label": "Jan", "value": 100 },\n  { "label": "Feb", "value": 150 },\n  { "label": "Mar", "value": 120 }\n]',
  bar_vertical: '[\n  { "label": "Product A", "value": 45 },\n  { "label": "Product B", "value": 65 },\n  { "label": "Product C", "value": 30 }\n]',
  scatter: '[\n  { "label": "Point 1", "x": 10, "y": 20 },\n  { "label": "Point 2", "x": 30, "y": 40 },\n  { "label": "Point 3", "x": 50, "y": 15 }\n]',
  bubble: '[\n  { "label": "Item 1", "x": 10, "y": 20, "r": 5 },\n  { "label": "Item 2", "x": 30, "y": 40, "r": 10 },\n  { "label": "Item 3", "x": 50, "y": 15, "r": 7 }\n]',
  pie: '[\n  { "label": "Category A", "value": 30 },\n  { "label": "Category B", "value": 45 },\n  { "label": "Category C", "value": 25 }\n]',
}

const DEFAULT_CHART_CONFIG: ChartConfig = {
  chart_type: 'line',
  include_insights: false,
  series_names: [],
  placeholder_mode: false,
  data: null,
}

interface ChartFormProps {
  onSubmit: (formData: ChartFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function ChartForm({ onSubmit, registerSubmit, isGenerating }: ChartFormProps) {
  // Basic fields
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  // Chart config
  const [chartType, setChartType] = useState<TextLabsChartType>('line')
  const [includeInsights, setIncludeInsights] = useState(false)
  const [seriesNamesInput, setSeriesNamesInput] = useState('')
  const [dataSource, setDataSource] = useState<'ai' | 'custom'>('ai')
  const [customDataInput, setCustomDataInput] = useState('')
  const [dataError, setDataError] = useState<string | null>(null)
  const [advancedModified, setAdvancedModified] = useState(false)

  // Section visibility
  const [showOptions, setShowOptions] = useState(false)
  const [showPosition, setShowPosition] = useState(false)

  // Position (no padding for CHART)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: true,
  })

  // Validate custom JSON
  const validateCustomData = useCallback((jsonStr: string): unknown[] | null => {
    if (!jsonStr.trim()) return null
    try {
      const parsed = JSON.parse(jsonStr)
      if (!Array.isArray(parsed)) {
        setDataError('Data must be a JSON array')
        return null
      }
      setDataError(null)
      return parsed
    } catch {
      setDataError('Invalid JSON format')
      return null
    }
  }, [])

  const handleSubmit = useCallback(() => {
    let data: unknown[] | null = null
    if (dataSource === 'custom' && customDataInput.trim()) {
      data = validateCustomData(customDataInput)
      if (!data && customDataInput.trim()) return // Don't submit with invalid JSON
    }

    const seriesNames = seriesNamesInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s)

    const formData: ChartFormData = {
      componentType: 'CHART',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate a placeholder chart') : prompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: DEFAULTS.zIndex,
      chartConfig: {
        chart_type: chartType,
        include_insights: includeInsights,
        series_names: seriesNames,
        placeholder_mode: contentSource === 'placeholder',
        data,
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
    }
    onSubmit(formData)
  }, [prompt, count, contentSource, chartType, includeInsights, seriesNamesInput, dataSource, customDataInput, advancedModified, positionConfig, onSubmit, validateCustomData])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  const loadTemplate = useCallback(() => {
    const template = DATA_TEMPLATES[chartType] || DATA_TEMPLATES.line!
    setCustomDataInput(template)
    setDataError(null)
    setAdvancedModified(true)
  }, [chartType])

  return (
    <div className="space-y-4">
      {/* Prompt */}
      {contentSource === 'ai' && (
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder="e.g., Show quarterly revenue growth for 2024 with strong Q3-Q4 performance"
          disabled={isGenerating}
        />
      )}

      {/* Content Source Toggle */}
      <ToggleRow
        label="Content Source"
        field="contentSource"
        value={contentSource}
        options={[
          { value: 'ai', label: 'AI Generated' },
          { value: 'placeholder', label: 'Placeholder' },
        ]}
        onChange={(_, v) => setContentSource(v as 'ai' | 'placeholder')}
      />

      {/* Basic Config */}
      <div className="space-y-3">
        {/* Count */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Count</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {[1, 2].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Chart Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => {
              setChartType(e.target.value as TextLabsChartType)
              setAdvancedModified(true)
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {CHART_TYPE_GROUPS.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.types.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Chart Options */}
      <CollapsibleSection title="Chart Options" isOpen={showOptions} onToggle={() => setShowOptions(!showOptions)}>
        <div className="space-y-3">
          {/* Include Insights */}
          <ToggleRow
            label="Include Insights"
            field="include_insights"
            value={includeInsights ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            onChange={(_, v) => {
              setIncludeInsights(v === 'true')
              setAdvancedModified(true)
            }}
          />

          {/* Series Names (only for multi-series chart types) */}
          {MULTI_SERIES_TYPES.includes(chartType) && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Series Names</label>
              <input
                type="text"
                value={seriesNamesInput}
                onChange={(e) => {
                  setSeriesNamesInput(e.target.value)
                  setAdvancedModified(true)
                }}
                placeholder="e.g., Revenue, Costs, Profit"
                className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-[10px] text-gray-500">Comma-separated names for each data series</p>
            </div>
          )}

          {/* Data Source */}
          <ToggleRow
            label="Data Source"
            field="dataSource"
            value={dataSource}
            options={[
              { value: 'ai', label: 'AI Generated' },
              { value: 'custom', label: 'Custom JSON' },
            ]}
            onChange={(_, v) => {
              setDataSource(v as 'ai' | 'custom')
              setAdvancedModified(true)
            }}
          />

          {/* Custom Data Input */}
          {dataSource === 'custom' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-300">Custom Data (JSON)</label>
                <button
                  onClick={loadTemplate}
                  className="text-[10px] text-purple-400 hover:text-purple-300"
                >
                  Load Template
                </button>
              </div>
              <textarea
                value={customDataInput}
                onChange={(e) => {
                  setCustomDataInput(e.target.value)
                  validateCustomData(e.target.value)
                  setAdvancedModified(true)
                }}
                rows={6}
                className={`w-full px-2.5 py-2 rounded-md bg-gray-700/50 border text-xs text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y ${
                  dataError ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder='[{ "label": "Jan", "value": 100 }]'
              />
              {dataError && (
                <p className="text-[10px] text-red-400">{dataError}</p>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Position (no padding for CHART) */}
      <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <PositionPresets
          positionConfig={positionConfig}
          onChange={setPositionConfig}
          elementType="CHART"
          onAdvancedModified={() => setAdvancedModified(true)}
        />
      </CollapsibleSection>
    </div>
  )
}

ChartForm.displayName = 'ChartForm'
