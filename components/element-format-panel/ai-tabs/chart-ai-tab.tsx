"use client"

import { useState, useMemo } from 'react'
import { BarChart3, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import {
  ChartType,
  ChartTheme,
  ChartDataFormat,
  CHART_TYPES,
  CHART_THEMES,
  CHART_DATA_FORMATS,
} from '@/types/elements'

export function ChartAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [chartType, setChartType] = useState<ChartType>('bar_vertical')
  const [chartTheme, setChartTheme] = useState<ChartTheme>('professional')
  const [dataFormat, setDataFormat] = useState<ChartDataFormat>('number')
  const [useSynthetic, setUseSynthetic] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Group chart types for display
  const standardCharts = useMemo(() => CHART_TYPES.filter(c => c.group === 'standard'), [])
  const d3Charts = useMemo(() => CHART_TYPES.filter(c => c.group === 'd3'), [])

  // Check if data format should be disabled (for certain D3 charts)
  const isDataFormatDisabled = chartType === 'd3_choropleth_usa' || chartType === 'd3_sankey'

  // Change chart type
  const handleChartTypeChange = async (type: ChartType) => {
    setChartType(type)
    try {
      await onSendCommand('setChartType', {
        elementId,
        type,
      })
    } catch (err) {
      // Silently handle - UI update is enough
    }
  }

  // Generate chart data with AI
  const handleGenerateData = async () => {
    if (!prompt.trim() && !useSynthetic) {
      setError('Please describe the data you want to visualize or enable synthetic data')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateChartData', {
        prompt: prompt.trim(),
        chartType,
        theme: chartTheme,
        dataFormat,
        useSynthetic,
        elementId,
        presentationId,
        slideIndex,
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate chart data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate chart data')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-amber-400">
        <BarChart3 className="h-4 w-4" />
        <span className="text-sm font-medium">Analytics / Chart</span>
      </div>

      {/* Chart Type Selector - Standard */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Standard Charts</label>
        <div className="grid grid-cols-4 gap-1">
          {standardCharts.slice(0, 8).map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 px-1 rounded text-xs font-medium transition-colors truncate",
                chartType === type
                  ? "bg-amber-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Second row of standard charts */}
        <div className="grid grid-cols-3 gap-1">
          {standardCharts.slice(8).map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 px-1 rounded text-xs font-medium transition-colors truncate",
                chartType === type
                  ? "bg-amber-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Type Selector - D3 Advanced */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Advanced (D3)</label>
        <div className="grid grid-cols-4 gap-1">
          {d3Charts.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 px-1 rounded text-xs font-medium transition-colors truncate",
                chartType === type
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme Selector */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Theme</label>
        <select
          value={chartTheme}
          onChange={(e) => setChartTheme(e.target.value as ChartTheme)}
          disabled={isGenerating || isApplying}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {CHART_THEMES.map(({ theme, label }) => (
            <option key={theme} value={theme}>{label}</option>
          ))}
        </select>
      </div>

      {/* Data Format Selector */}
      {!isDataFormatDisabled && (
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Data Format</label>
          <div className="grid grid-cols-3 gap-1.5">
            {CHART_DATA_FORMATS.map(({ format, label, symbol }) => (
              <button
                key={format}
                onClick={() => setDataFormat(format)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1",
                  dataFormat === format
                    ? "bg-amber-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                )}
              >
                <span className="text-amber-300">{symbol}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">generate with AI</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* Synthetic Data Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">Use synthetic/demo data</label>
        <button
          onClick={() => setUseSynthetic(!useSynthetic)}
          disabled={isGenerating || isApplying}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            useSynthetic ? "bg-amber-600" : "bg-gray-700"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
              useSynthetic ? "translate-x-5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">
          {useSynthetic ? 'Describe the chart topic (optional)' : 'Describe the data'}
        </label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder={
            useSynthetic
              ? "E.g., Quarterly revenue growth for a tech company..."
              : "E.g., Monthly revenue for 2024 showing growth trend..."
          }
          disabled={isGenerating}
          rows={3}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-2 py-1.5 bg-red-600/20 border border-red-500 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerateData}
        disabled={isGenerating || isApplying || (!prompt.trim() && !useSynthetic)}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isGenerating || isApplying || (!prompt.trim() && !useSynthetic)
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-amber-600 hover:bg-amber-700 text-white"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Chart
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        {useSynthetic
          ? "AI will generate realistic demo data for your chart"
          : "AI will generate data based on your description"}
      </p>
    </div>
  )
}
