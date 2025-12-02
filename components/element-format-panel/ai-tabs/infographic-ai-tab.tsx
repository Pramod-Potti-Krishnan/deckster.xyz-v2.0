"use client"

import { useState } from 'react'
import { LayoutGrid, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { INFOGRAPHIC_TYPES, InfographicType } from '@/types/elements'

// Icons/descriptions for each infographic type
const INFOGRAPHIC_DESCRIPTIONS: Record<InfographicType, string> = {
  timeline: 'Linear progression of events',
  process: 'Step-by-step workflow',
  comparison: 'Side-by-side analysis',
  statistics: 'Numbers & percentages',
  hierarchy: 'Org chart or tree',
  list: 'Numbered or icon list',
  cycle: 'Circular process',
  pyramid: 'Layered hierarchy',
  matrix: 'Grid comparison',
  venn: 'Overlapping concepts',
  funnel: 'Narrowing stages',
  roadmap: 'Project timeline',
}

export function InfographicAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [infographicType, setInfographicType] = useState<InfographicType | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate infographic with AI
  const handleGenerate = async () => {
    if (!infographicType) {
      setError('Please select an infographic type')
      return
    }

    if (!prompt.trim()) {
      setError('Please describe your infographic content')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateInfographic', {
        prompt: prompt.trim(),
        type: infographicType,
        elementId,
        presentationId,
        slideIndex,
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate infographic')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate infographic')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-purple-400">
        <LayoutGrid className="h-4 w-4" />
        <span className="text-sm font-medium">Infographic</span>
      </div>

      {/* Infographic Type Selector - 12 types in a 2-column grid */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Type (select one)</label>
        <div className="grid grid-cols-2 gap-1.5">
          {INFOGRAPHIC_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => setInfographicType(type)}
              disabled={isGenerating || isApplying}
              className={cn(
                "px-2 py-2 rounded-md text-xs font-medium transition-colors text-left",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                infographicType === type
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
              title={INFOGRAPHIC_DESCRIPTIONS[type]}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected type description */}
      {infographicType && (
        <div className="px-2 py-1.5 bg-purple-600/10 border border-purple-600/30 rounded text-xs text-purple-300">
          {INFOGRAPHIC_DESCRIPTIONS[infographicType]}
        </div>
      )}

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Describe your infographic</label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder={infographicType === 'timeline'
            ? "E.g., Company milestones from 2020 to 2024..."
            : infographicType === 'process'
            ? "E.g., 5-step customer onboarding process..."
            : infographicType === 'comparison'
            ? "E.g., Compare Plan A vs Plan B features..."
            : infographicType === 'statistics'
            ? "E.g., Key metrics: 50% growth, 1M users..."
            : "Describe the content you want to visualize..."}
          disabled={isGenerating}
          rows={4}
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
        disabled={isGenerating || isApplying || !infographicType || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isGenerating || isApplying || !infographicType || !prompt.trim()
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white"
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
            Generate Infographic
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        AI will create a visual infographic based on your description
      </p>
    </div>
  )
}
