"use client"

import { useState } from 'react'
import { Image, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { TypeSelector } from '../shared/type-selector'
import { IMAGE_STYLES, ASPECT_RATIOS, ImageStyle, AspectRatio } from '@/types/elements'

export function ImageAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<ImageStyle | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe the image you want to generate')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateImage', {
        prompt: prompt.trim(),
        style: style || undefined,
        aspectRatio,
        elementId,
        presentationId,
        slideIndex,
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
      } else {
        setError(result.error || 'Failed to generate image')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-green-400">
        <Image className="h-4 w-4" />
        <span className="text-sm font-medium">Generate Image</span>
      </div>

      {/* Prompt Input */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Describe the image you want</label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder="E.g., A modern office workspace with natural lighting and plants..."
          disabled={isGenerating}
          rows={4}
        />
      </div>

      {/* Style Presets */}
      <TypeSelector
        label="Style"
        options={IMAGE_STYLES.map(s => ({ type: s.style, label: s.label }))}
        value={style}
        onChange={setStyle}
        disabled={isGenerating}
        columns={3}
      />

      {/* Aspect Ratio */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Aspect Ratio</label>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {ASPECT_RATIOS.map(({ ratio, label }) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              disabled={isGenerating}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                aspectRatio === ratio
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
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
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isGenerating || isApplying || !prompt.trim()
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 text-white"
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
            Generate Image
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        AI will generate an image based on your description
      </p>
    </div>
  )
}
