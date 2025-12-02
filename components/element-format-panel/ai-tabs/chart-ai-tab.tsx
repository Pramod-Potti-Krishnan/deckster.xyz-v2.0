"use client"

import { useState } from 'react'
import { BarChart3, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { TypeSelector } from '../shared/type-selector'
import { CHART_TYPES, ChartType, ChartPalette, CHART_PALETTES } from '@/types/elements'

// Chart palette presets for UI
const PALETTE_OPTIONS: { type: ChartPalette; label: string }[] = [
  { type: 'default', label: 'Default' },
  { type: 'professional', label: 'Professional' },
  { type: 'vibrant', label: 'Vibrant' },
  { type: 'pastel', label: 'Pastel' },
  { type: 'monochrome', label: 'Mono' },
]

export function ChartAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [colorPalette, setColorPalette] = useState<ChartPalette>('default')
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Change color palette
  const handlePaletteChange = async (palette: ChartPalette) => {
    setColorPalette(palette)
    try {
      await onSendCommand('setChartColors', {
        elementId,
        palette,
        customColors: CHART_PALETTES[palette],
      })
    } catch (err) {
      // Silently handle
    }
  }

  // Generate chart data with AI
  const handleGenerateData = async () => {
    if (!prompt.trim()) {
      setError('Please describe the data you want to visualize')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateChartData', {
        prompt: prompt.trim(),
        chartType,
        colorPalette,
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
        <span className="text-sm font-medium">Chart</span>
      </div>

      {/* Chart Type Selector */}
      <TypeSelector
        label="Type"
        options={CHART_TYPES}
        value={chartType}
        onChange={handleChartTypeChange}
        disabled={isGenerating || isApplying}
        columns={4}
      />

      {/* Color Palette */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Color Scheme</label>
        <div className="grid grid-cols-5 gap-1.5">
          {PALETTE_OPTIONS.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handlePaletteChange(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 rounded-md text-xs font-medium transition-colors",
                colorPalette === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Color preview */}
        <div className="flex gap-1 pt-1">
          {CHART_PALETTES[colorPalette].slice(0, 6).map((color, idx) => (
            <div
              key={idx}
              className="w-6 h-4 rounded"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">generate data with AI</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Describe the data</label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder="E.g., Monthly revenue for 2024 showing growth trend..."
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
        disabled={isGenerating || isApplying || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isGenerating || isApplying || !prompt.trim()
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
        AI will generate data and update the chart
      </p>
    </div>
  )
}
