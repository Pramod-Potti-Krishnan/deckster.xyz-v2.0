"use client"

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PanelSection,
  ButtonGroup,
  Divider,
} from '@/components/ui/panel'

interface AITabProps {
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  isApplying: boolean
  elementId: string
  presentationId?: string | null
  slideIndex?: number
}

const QUICK_ACTIONS = [
  { label: 'Shorten', action: 'shorten' },
  { label: 'Expand', action: 'expand' },
  { label: 'Fix Grammar', action: 'grammar' },
  { label: 'Add Bullets', action: 'bulletize' },
  { label: 'Simplify', action: 'simplify' },
  { label: 'Professional', action: 'professional' },
]

const TONE_OPTIONS = [
  { value: 'professional', label: 'Prof' },
  { value: 'casual', label: 'Casual' },
  { value: 'persuasive', label: 'Pers' },
  { value: 'technical', label: 'Tech' },
]

const STYLE_OPTIONS = [
  { value: 'expand', label: 'Expand' },
  { value: 'summarize', label: 'Summary' },
  { value: 'rewrite', label: 'Rewrite' },
]

export function AITab({ onSendCommand, isApplying, elementId, presentationId, slideIndex }: AITabProps) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState<string | null>(null)
  const [style, setStyle] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setPrompt('')
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
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        <span className="text-[11px] font-medium text-gray-300">AI Content Assistant</span>
      </div>

      {/* Quick Actions */}
      <PanelSection title="Quick Actions">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map(({ label, action }) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isGenerating || isApplying}
              className={cn(
                "px-3 py-1.5 rounded-full",
                "bg-gray-800/60 border border-gray-700/50",
                "text-[10px] text-gray-300",
                "hover:bg-gray-700/50 hover:border-gray-600 hover:text-white",
                "transition-all duration-150",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      <Divider label="or generate new" />

      {/* Prompt */}
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to write..."
          disabled={isGenerating}
          className={cn(
            "w-full h-20 px-3 py-2.5 rounded-lg",
            "bg-gray-800/60 border border-gray-700/50",
            "text-[11px] text-white placeholder:text-gray-500",
            "resize-none",
            "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20",
            "transition-all duration-150"
          )}
        />
      </div>

      {/* Tone Selector */}
      <PanelSection title="Tone">
        <ButtonGroup
          options={TONE_OPTIONS}
          value={tone}
          onChange={(value) => setTone(tone === value ? null : value)}
          disabled={isGenerating}
          accentColor="indigo"
        />
      </PanelSection>

      {/* Style Selector */}
      <PanelSection title="Style">
        <ButtonGroup
          options={STYLE_OPTIONS}
          value={style}
          onChange={(value) => setStyle(style === value ? null : value)}
          disabled={isGenerating}
          accentColor="purple"
        />
      </PanelSection>

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
          "w-full flex items-center justify-center gap-2",
          "h-10 rounded-lg",
          "text-[11px] font-medium",
          "transition-all duration-150",
          isGenerating || isApplying || !prompt.trim()
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/20 hover:shadow-xl hover:shadow-indigo-900/30"
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
            Generate Content
          </>
        )}
      </button>

      {/* Helper Text */}
      <p className="text-[9px] text-gray-600 text-center">
        AI generates styled HTML content
      </p>
    </div>
  )
}
