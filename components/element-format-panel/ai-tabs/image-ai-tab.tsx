"use client"

import { useState } from 'react'
import { Image, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { TypeSelector } from '../shared/type-selector'
import {
  IMAGE_STYLES,
  ASPECT_RATIOS,
  IMAGE_QUALITY_OPTIONS,
  ImageStyle,
  AspectRatio,
  ImageQuality,
} from '@/types/elements'

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
  const [removeBackground, setRemoveBackground] = useState(false)
  const [quality, setQuality] = useState<ImageQuality>('standard')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
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
        removeBackground,
        quality,
        negativePrompt: negativePrompt.trim() || undefined,
        elementId,
        presentationId,
        slideIndex,
      })

      if (result.success) {
        setPrompt('') // Clear prompt on success
        setNegativePrompt('') // Clear negative prompt too
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
                  ? "bg-green-600 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Remove Background Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">Remove background</label>
        <button
          onClick={() => setRemoveBackground(!removeBackground)}
          disabled={isGenerating || isApplying}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            removeBackground ? "bg-green-600" : "bg-gray-700"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
              removeBackground ? "translate-x-5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Advanced Options Accordion */}
      <div className="border border-gray-700 rounded-md overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-xs font-medium text-gray-300"
        >
          <span>Advanced Options</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              showAdvanced ? "rotate-180" : ""
            )}
          />
        </button>
        {showAdvanced && (
          <div className="p-3 space-y-4 bg-gray-900">
            {/* Quality */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Quality</label>
              <div className="flex bg-gray-800 rounded-lg p-0.5">
                {IMAGE_QUALITY_OPTIONS.map(({ quality: q, label }) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    disabled={isGenerating}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                      quality === q
                        ? "bg-green-600 text-white"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">
                High quality may take longer to generate
              </p>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">
                Negative Prompt
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="E.g., blurry, low quality, watermark, text..."
                disabled={isGenerating}
                rows={2}
                className={cn(
                  "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md",
                  "text-sm text-gray-200 placeholder-gray-500",
                  "focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "resize-none"
                )}
              />
              <p className="text-[10px] text-gray-500">
                Describe what you don&apos;t want in the image
              </p>
            </div>
          </div>
        )}
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
