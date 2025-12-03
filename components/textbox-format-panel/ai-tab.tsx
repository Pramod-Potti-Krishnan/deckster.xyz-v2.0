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
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-blue-400">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">AI Content Assistant</span>
      </div>

      {/* Quick Actions - Chips Grid */}
      <div className="space-y-2">
        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Quick Actions</label>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, action }) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isGenerating || isApplying}
              className={cn(
                "px-3 py-1.5 bg-gray-800 rounded-full text-xs border border-gray-700",
                "hover:bg-gray-700 hover:border-gray-600 transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-800"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-gray-900 px-2 text-gray-500">or generate new</span>
        </div>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to write..."
          disabled={isGenerating}
          className={cn(
            "w-full h-20 px-3 py-2.5 bg-gray-800 rounded-lg text-sm",
            "placeholder:text-gray-500 resize-none border border-transparent",
            "focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-all"
          )}
        />
      </div>

      {/* Tone Presets */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Tone</label>
        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-800">
          {TONE_PRESETS.map(({ label, value, fullLabel }) => (
            <button
              key={value}
              onClick={() => setTone(tone === value ? null : value)}
              disabled={isGenerating}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-md transition-all",
                tone === value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              )}
              title={fullLabel}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Style Presets */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Style</label>
        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-800">
          {STYLE_PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStyle(style === value ? null : value)}
              disabled={isGenerating}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-md transition-all",
                style === value
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || isApplying || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg",
          isGenerating || isApplying || !prompt.trim()
            ? "bg-gray-800 text-gray-500 cursor-not-allowed shadow-none"
            : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-900/20"
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
      <p className="text-[10px] text-gray-600 text-center">
        Generates HTML content with inline styles
      </p>
    </div>
  )
}
