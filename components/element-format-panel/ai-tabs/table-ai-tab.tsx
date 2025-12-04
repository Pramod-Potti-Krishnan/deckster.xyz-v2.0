"use client"

import { useState } from 'react'
import { Table, Type, Loader2, Sparkles, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import {
  TextFormat,
  TextTone,
  BulletStyle,
  TableStyle,
  TEXT_FORMATS,
  TEXT_TONES,
  BULLET_STYLES,
  TABLE_STYLES,
} from '@/types/elements'

type GenerationMode = 'text' | 'table'

export function TableAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  // Mode selection
  const [mode, setMode] = useState<GenerationMode>('table')

  // Table-specific state
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(3)
  const [hasHeaderRow, setHasHeaderRow] = useState(true)
  const [tableStyle, setTableStyle] = useState<TableStyle>('professional')

  // Text-specific state
  const [textFormat, setTextFormat] = useState<TextFormat>('paragraph')
  const [textTone, setTextTone] = useState<TextTone>('professional')
  const [bulletStyle, setBulletStyle] = useState<BulletStyle>('disc')
  const [includeEmoji, setIncludeEmoji] = useState(false)

  // Shared state
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if bullet style should be shown
  const showBulletStyle = mode === 'text' && (textFormat === 'bullets' || textFormat === 'mixed')

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

  // Generate content with AI
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(`Please describe the ${mode === 'text' ? 'content' : 'data'} you want to generate`)
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      if (mode === 'table') {
        const result = await onSendCommand('generateTableData', {
          prompt: prompt.trim(),
          rows,
          cols,
          hasHeaderRow,
          tableStyle,
          elementId,
          presentationId,
          slideIndex,
        })

        if (result.success) {
          setPrompt('')
        } else {
          setError(result.error || 'Failed to generate table data')
        }
      } else {
        const result = await onSendCommand('generateText', {
          prompt: prompt.trim(),
          format: textFormat,
          tone: textTone,
          bulletStyle: showBulletStyle ? bulletStyle : undefined,
          includeEmoji,
          elementId,
          presentationId,
          slideIndex,
        })

        if (result.success) {
          setPrompt('')
        } else {
          setError(result.error || 'Failed to generate text')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to generate ${mode}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Mode Selector */}
      <div className="flex bg-gray-800 rounded-lg p-0.5">
        <button
          onClick={() => setMode('text')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
            mode === 'text'
              ? "bg-indigo-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Type className="h-3.5 w-3.5" />
          Generate Text
        </button>
        <button
          onClick={() => setMode('table')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
            mode === 'table'
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Table className="h-3.5 w-3.5" />
          Generate Table
        </button>
      </div>

      {/* Text Mode Options */}
      {mode === 'text' && (
        <>
          {/* Text Format */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Format</label>
            <div className="grid grid-cols-3 gap-1">
              {TEXT_FORMATS.map(({ format, label }) => (
                <button
                  key={format}
                  onClick={() => setTextFormat(format)}
                  disabled={isGenerating || isApplying}
                  className={cn(
                    "py-1.5 rounded text-xs font-medium transition-colors",
                    textFormat === format
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Tone */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Tone</label>
            <div className="grid grid-cols-3 gap-1">
              {TEXT_TONES.map(({ tone, label }) => (
                <button
                  key={tone}
                  onClick={() => setTextTone(tone)}
                  disabled={isGenerating || isApplying}
                  className={cn(
                    "py-1.5 rounded text-xs font-medium transition-colors",
                    textTone === tone
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bullet Style (conditional) */}
          {showBulletStyle && (
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Bullet Style</label>
              <div className="grid grid-cols-6 gap-1">
                {BULLET_STYLES.map(({ style, label, symbol }) => (
                  <button
                    key={style}
                    onClick={() => setBulletStyle(style)}
                    disabled={isGenerating || isApplying}
                    className={cn(
                      "py-2 rounded text-sm font-medium transition-colors flex flex-col items-center",
                      bulletStyle === style
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    )}
                    title={label}
                  >
                    <span className="text-lg">{symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Include Emoji Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">Include emoji</label>
            <button
              onClick={() => setIncludeEmoji(!includeEmoji)}
              disabled={isGenerating || isApplying}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                includeEmoji ? "bg-indigo-600" : "bg-gray-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                  includeEmoji ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </>
      )}

      {/* Table Mode Options */}
      {mode === 'table' && (
        <>
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
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  hasHeaderRow ? "bg-blue-600" : "bg-gray-700"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                    hasHeaderRow ? "translate-x-5" : "translate-x-1"
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

          {/* Table Style */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Table Style</label>
            <div className="grid grid-cols-3 gap-1">
              {TABLE_STYLES.map(({ style, label }) => (
                <button
                  key={style}
                  onClick={() => setTableStyle(style)}
                  disabled={isGenerating || isApplying}
                  className={cn(
                    "py-1.5 rounded text-xs font-medium transition-colors",
                    tableStyle === style
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">generate with AI</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">
          {mode === 'text' ? 'Describe the content' : 'Describe the data'}
        </label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder={
            mode === 'text'
              ? textFormat === 'bullets'
                ? "E.g., Key benefits of our product for enterprise customers..."
                : textFormat === 'headline'
                ? "E.g., An attention-grabbing headline for our Q4 results..."
                : textFormat === 'quote'
                ? "E.g., An inspiring quote about innovation and leadership..."
                : "E.g., Introduction paragraph about our company's mission..."
              : "E.g., Q4 2024 sales by region with revenue and growth percentage..."
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
        onClick={handleGenerate}
        disabled={isGenerating || isApplying || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isGenerating || isApplying || !prompt.trim()
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : mode === 'text'
            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
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
            Generate {mode === 'text' ? 'Text' : 'Table Data'}
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        {mode === 'text'
          ? 'AI will generate text content based on your description'
          : 'AI will generate table data based on your description'}
      </p>
    </div>
  )
}
