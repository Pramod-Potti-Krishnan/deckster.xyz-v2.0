"use client"

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AITabProps {
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
  presentationId?: string | null
  slideIndex?: number
}

// Quick action chips - execute immediately on existing text
const QUICK_ACTIONS = [
  { label: 'Make shorter', action: 'shorten' },
  { label: 'Make longer', action: 'expand' },
  { label: 'Fix grammar', action: 'grammar' },
  { label: 'Add bullets', action: 'bulletize' },
  { label: 'Simplify', action: 'simplify' },
  { label: 'Professional', action: 'professional' },
]

// Tone presets
const TONE_PRESETS = [
  { label: 'Prof', value: 'professional', fullLabel: 'Professional' },
  { label: 'Casual', value: 'casual', fullLabel: 'Casual' },
  { label: 'Pers', value: 'persuasive', fullLabel: 'Persuasive' },
  { label: 'Tech', value: 'technical', fullLabel: 'Technical' },
]

// Style presets
const STYLE_PRESETS = [
  { label: 'Expand', value: 'expand' },
  { label: 'Summarize', value: 'summarize' },
  { label: 'Rewrite', value: 'rewrite' },
]

export function AITab({ onSendCommand, isApplying, elementId, presentationId, slideIndex }: AITabProps) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState<string | null>(null)
  const [style, setStyle] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Execute quick action on existing text
  const handleQuickAction = async (action: string) => {
    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateTextBoxContent', {
        action,
        elementId,
        presentationId,
        slideIndex
      })

      if (!result.success) {
        setError(result.error || 'Action failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setIsGenerating(false)
    }
  }

  // Generate content from prompt
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateTextBoxContent', {
        prompt: prompt.trim(),
        tone: tone || undefined,
        style: style || undefined,
        elementId,
        presentationId,
        slideIndex
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-blue-400">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">AI Content</span>
      </div>

      {/* Quick Actions - Chips Grid */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Quick Actions</label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map(({ label, action }) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isGenerating || isApplying}
              className={cn(
                "px-2.5 py-1 bg-gray-800 rounded-full text-xs",
                "hover:bg-gray-700 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">or write a prompt</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* Prompt Input - Compact */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want..."
        disabled={isGenerating}
        className={cn(
          "w-full h-16 px-3 py-2 bg-gray-800 rounded-lg text-sm",
          "placeholder:text-gray-500 resize-none",
          "focus:outline-none focus:ring-1 focus:ring-blue-500"
        )}
      />

      {/* Tone Presets - Compact row */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Tone</label>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {TONE_PRESETS.map(({ label, value, fullLabel }) => (
            <button
              key={value}
              onClick={() => setTone(tone === value ? null : value)}
              disabled={isGenerating}
              className={cn(
                "flex-1 py-1 text-xs rounded transition-colors",
                tone === value ? "bg-blue-600" : "hover:bg-gray-700"
              )}
              title={fullLabel}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Style Presets - Compact row */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Style</label>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {STYLE_PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStyle(style === value ? null : value)}
              disabled={isGenerating}
              className={cn(
                "flex-1 py-1 text-xs rounded transition-colors",
                style === value ? "bg-blue-600" : "hover:bg-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
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
          "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
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
            Generate Content
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        Output: HTML, CSS & JS content
      </p>
    </div>
  )
}
