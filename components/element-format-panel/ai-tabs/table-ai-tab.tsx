"use client"

import { useState } from 'react'
import { Table, Type, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
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
import {
  PanelSection,
  Stepper,
  Toggle,
  Divider,
} from '@/components/ui/panel'

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

  // Toggle header row
  const handleHeaderToggle = async (value: boolean) => {
    setHasHeaderRow(value)
    try {
      await onSendCommand('setTableHeaderStyle', {
        elementId,
        hasHeader: value,
      })
    } catch (err) {
      // Silently handle
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
    <div className="p-4 space-y-5">
      {/* Mode Selector */}
      <div className="flex bg-gray-800/50 rounded-lg p-[3px]">
        <button
          onClick={() => setMode('text')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-md transition-all",
            mode === 'text'
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Type className="h-3.5 w-3.5" />
          Text
        </button>
        <button
          onClick={() => setMode('table')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-md transition-all",
            mode === 'table'
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Table className="h-3.5 w-3.5" />
          Table
        </button>
      </div>

      {/* Text Mode Options */}
      {mode === 'text' && (
        <>
          {/* Text Format */}
          <PanelSection title="Format">
            <div className="grid grid-cols-3 gap-1">
              {TEXT_FORMATS.map(({ format, label }) => (
                <button
                  key={format}
                  onClick={() => setTextFormat(format)}
                  disabled={isGenerating || isApplying}
                  className={cn(
                    "py-1.5 rounded-md text-[10px] font-medium transition-all",
                    textFormat === format
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </PanelSection>

          {/* Text Tone */}
          <PanelSection title="Tone">
            <div className="grid grid-cols-3 gap-1">
              {TEXT_TONES.map(({ tone, label }) => (
                <button
                  key={tone}
                  onClick={() => setTextTone(tone)}
                  disabled={isGenerating || isApplying}
                  className={cn(
                    "py-1.5 rounded-md text-[10px] font-medium transition-all",
                    textTone === tone
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </PanelSection>

          {/* Bullet Style (conditional) */}
          {showBulletStyle && (
            <PanelSection title="Bullet Style">
              <div className="grid grid-cols-6 gap-1">
                {BULLET_STYLES.map(({ style, label, symbol }) => (
                  <button
                    key={style}
                    onClick={() => setBulletStyle(style)}
                    disabled={isGenerating || isApplying}
                    className={cn(
                      "py-2 rounded-md text-sm font-medium transition-all flex flex-col items-center",
                      bulletStyle === style
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50"
                    )}
                    title={label}
                  >
                    <span className="text-lg">{symbol}</span>
                  </button>
                ))}
              </div>
            </PanelSection>
          )}

          {/* Include Emoji */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Include emoji</span>
            <Toggle
              checked={includeEmoji}
              onChange={setIncludeEmoji}
              disabled={isGenerating || isApplying}
              accentColor="indigo"
            />
          </div>
        </>
      )}

      {/* Table Mode Options */}
      {mode === 'table' && (
        <>
          {/* Table Size */}
          <PanelSection title="Size">
            <div className="space-y-3">
              {/* Rows Stepper */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-300">Rows</span>
                <Stepper
                  value={rows}
                  onChange={setRows}
                  min={1}
                  max={20}
                  disabled={isApplying}
                />
              </div>

              {/* Columns Stepper */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-300">Columns</span>
                <Stepper
                  value={cols}
                  onChange={setCols}
                  min={1}
                  max={10}
                  disabled={isApplying}
                />
              </div>

              {/* Header Row */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-300">Header Row</span>
                <Toggle
                  checked={hasHeaderRow}
                  onChange={handleHeaderToggle}
                  disabled={isApplying}
                  accentColor="blue"
                />
              </div>
            </div>
          </PanelSection>

          {/* Apply Size Button */}
          <button
            onClick={handleUpdateSize}
            disabled={isApplying}
            className={cn(
              "w-full py-2 rounded-lg text-[11px] font-medium transition-all",
              "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Apply Size
          </button>

          {/* Table Style */}
          <PanelSection title="Style">
            <div className="grid grid-cols-3 gap-1">
              {TABLE_STYLES.map(({ style, label }) => (
                <button
                  key={style}
                  onClick={() => setTableStyle(style)}
                  disabled={isGenerating || isApplying}
                  className={cn(
                    "py-1.5 rounded-md text-[10px] font-medium transition-all",
                    tableStyle === style
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </PanelSection>
        </>
      )}

      <Divider label="generate with AI" />

      {/* AI Prompt */}
      <div className="space-y-2">
        <span className="text-[10px] text-gray-500">
          {mode === 'text' ? 'Describe the content' : 'Describe the data'}
        </span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === 'text'
              ? textFormat === 'bullets'
                ? "E.g., Key benefits of our product..."
                : textFormat === 'headline'
                ? "E.g., Attention-grabbing headline for Q4..."
                : "E.g., Paragraph about company mission..."
              : "E.g., Q4 2024 sales by region..."
          }
          disabled={isGenerating}
          rows={3}
          className={cn(
            "w-full px-3 py-2 rounded-lg resize-none",
            "bg-gray-800/60 border border-gray-700/50",
            "text-[11px] text-white placeholder:text-gray-500",
            mode === 'text'
              ? "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
              : "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20",
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
        onClick={handleGenerate}
        disabled={isGenerating || isApplying || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-10 rounded-lg",
          "text-[11px] font-medium transition-all duration-150",
          isGenerating || isApplying || !prompt.trim()
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : mode === 'text'
            ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20"
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
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
            Generate {mode === 'text' ? 'Text' : 'Table'}
          </>
        )}
      </button>

      {/* Helper Text */}
      <p className="text-[9px] text-gray-600 text-center">
        {mode === 'text'
          ? 'AI generates text from your description'
          : 'AI generates table data from your description'}
      </p>
    </div>
  )
}
