"use client"

import { useState } from 'react'
import { Table, Loader2, Sparkles, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'

export function TableAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(3)
  const [hasHeaderRow, setHasHeaderRow] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update table size
  const handleUpdateSize = async () => {
    try {
      await onSendCommand('resizeTable', {
        elementId,
        rows,
        cols,
        hasHeaderRow,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table')
    }
  }

  // Add/remove rows
  const handleRowChange = (delta: number) => {
    const newRows = Math.max(1, Math.min(20, rows + delta))
    setRows(newRows)
  }

  // Add/remove columns
  const handleColChange = (delta: number) => {
    const newCols = Math.max(1, Math.min(10, cols + delta))
    setCols(newCols)
  }

  // Toggle header row
  const handleHeaderToggle = async () => {
    const newHasHeader = !hasHeaderRow
    setHasHeaderRow(newHasHeader)
    try {
      await onSendCommand('setTableHeaderStyle', {
        elementId,
        hasHeader: newHasHeader,
      })
    } catch (err) {
      // Silently handle - will be retried on update
    }
  }

  // Generate table data with AI
  const handleGenerateData = async () => {
    if (!prompt.trim()) {
      setError('Please describe the data you want to generate')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateTableData', {
        prompt: prompt.trim(),
        rows,
        cols,
        hasHeaderRow,
        elementId,
        presentationId,
        slideIndex,
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate table data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate table data')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-blue-400">
        <Table className="h-4 w-4" />
        <span className="text-sm font-medium">Table</span>
      </div>

      {/* Table Size */}
      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Size</label>

        {/* Rows Stepper */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Rows</span>
          <div className="flex items-center bg-gray-800 rounded-lg">
            <button
              onClick={() => handleRowChange(-1)}
              disabled={isApplying || rows <= 1}
              className="p-1.5 rounded-l-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-10 text-center text-sm">{rows}</span>
            <button
              onClick={() => handleRowChange(1)}
              disabled={isApplying || rows >= 20}
              className="p-1.5 rounded-r-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Columns Stepper */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Columns</span>
          <div className="flex items-center bg-gray-800 rounded-lg">
            <button
              onClick={() => handleColChange(-1)}
              disabled={isApplying || cols <= 1}
              className="p-1.5 rounded-l-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-10 text-center text-sm">{cols}</span>
            <button
              onClick={() => handleColChange(1)}
              disabled={isApplying || cols >= 10}
              className="p-1.5 rounded-r-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Header Row Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Header Row</span>
          <button
            onClick={handleHeaderToggle}
            disabled={isApplying}
            className={cn(
              "w-9 h-5 rounded-full transition-colors relative",
              hasHeaderRow ? "bg-blue-600" : "bg-gray-700"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                hasHeaderRow ? "left-[18px]" : "left-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {/* Apply Size Button */}
      <button
        onClick={handleUpdateSize}
        disabled={isApplying}
        className={cn(
          "w-full py-2 rounded-lg text-xs font-medium transition-colors",
          "bg-gray-800 text-gray-300 hover:bg-gray-700",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        Apply Size
      </button>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">or generate with AI</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Describe the data</label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder="E.g., Q4 2024 sales by region with revenue and growth percentage..."
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
            : "bg-blue-600 hover:bg-blue-700 text-white"
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
            Generate Table Data
          </>
        )}
      </button>
    </div>
  )
}
