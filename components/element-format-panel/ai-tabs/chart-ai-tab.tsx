"use client"

import { useState, useMemo } from 'react'
import { BarChart3, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import {
  ChartType,
  ChartTheme,
  ChartDataFormat,
  CHART_TYPES,
  CHART_THEMES,
  CHART_DATA_FORMATS,
} from '@/types/elements'
import {
  PanelSection,
  PanelSelect,
  Toggle,
  Divider,
} from '@/components/ui/panel'

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
        setPrompt('')
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
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-amber-400" />
        <span className="text-[11px] font-medium text-gray-300">Chart Generator</span>
      </div>

      {/* Standard Charts */}
      <PanelSection title="Standard Charts">
        <div className="grid grid-cols-4 gap-1">
          {standardCharts.slice(0, 8).map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 px-1 rounded-md text-[10px] font-medium truncate transition-all",
                chartType === type
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
        {standardCharts.length > 8 && (
          <div className="grid grid-cols-3 gap-1">
            {standardCharts.slice(8).map(({ type, label }) => (
              <button
                key={type}
                onClick={() => handleChartTypeChange(type)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "py-1.5 px-1 rounded-md text-[10px] font-medium truncate transition-all",
                  chartType === type
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                )}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </PanelSection>

      {/* D3 Advanced Charts */}
      <PanelSection title="Advanced (D3)" collapsible defaultOpen={false}>
        <div className="grid grid-cols-4 gap-1">
          {d3Charts.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 px-1 rounded-md text-[10px] font-medium truncate transition-all",
                chartType === type
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Theme Selector */}
      <PanelSection title="Theme">
        <PanelSelect
          options={CHART_THEMES.map(({ theme, label }) => ({ value: theme, label }))}
          value={chartTheme}
          onChange={(value) => setChartTheme(value as ChartTheme)}
          disabled={isGenerating || isApplying}
        />
      </PanelSection>

      {/* Data Format Selector */}
      {!isDataFormatDisabled && (
        <PanelSection title="Data Format">
          <div className="grid grid-cols-3 gap-1">
            {CHART_DATA_FORMATS.map(({ format, label, symbol }) => (
              <button
                key={format}
                onClick={() => setDataFormat(format)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "py-1.5 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1",
                  dataFormat === format
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                )}
              >
                <span className="text-amber-300">{symbol}</span>
                {label}
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      <Divider label="generate with AI" />

      {/* Synthetic Data Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Use synthetic/demo data</span>
        <Toggle
          checked={useSynthetic}
          onChange={setUseSynthetic}
          disabled={isGenerating || isApplying}
          accentColor="amber"
        />
      </div>

      {/* AI Prompt */}
      <div className="space-y-2">
        <span className="text-[10px] text-gray-500">
          {useSynthetic ? 'Describe the chart topic (optional)' : 'Describe the data'}
        </span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            useSynthetic
              ? "E.g., Quarterly revenue growth for a tech company..."
              : "E.g., Monthly revenue for 2024 showing growth trend..."
          }
          disabled={isGenerating}
          rows={3}
          className={cn(
            "w-full px-3 py-2 rounded-lg resize-none",
            "bg-gray-800/60 border border-gray-700/50",
            "text-[11px] text-white placeholder:text-gray-500",
            "focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20",
            "transition-all duration-150"
          )}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className={cn(
          "px-3 py-2 rounded-lg",
          "bg-red-500/10 border border-red-500/20",
          "text-[10px] text-red-400"
        )}>
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerateData}
        disabled={isGenerating || isApplying || (!prompt.trim() && !useSynthetic)}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-10 rounded-lg",
          "text-[11px] font-medium transition-all duration-150",
          isGenerating || isApplying || (!prompt.trim() && !useSynthetic)
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Chart
          </>
        )}
      </button>

      {/* Helper Text */}
      <p className="text-[9px] text-gray-600 text-center">
        {useSynthetic
          ? "AI will generate realistic demo data"
          : "AI will generate data based on your description"}
      </p>
    </div>
  )
}
