"use client"

import { useState } from 'react'
import { Image, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import {
  IMAGE_STYLES,
  ASPECT_RATIOS,
  IMAGE_QUALITY_OPTIONS,
  ImageStyle,
  AspectRatio,
  ImageQuality,
} from '@/types/elements'
import {
  PanelSection,
  Toggle,
  Divider,
} from '@/components/ui/panel'

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
        setPrompt('')
        setNegativePrompt('')
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
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Image className="h-4 w-4 text-green-400" />
        <span className="text-[11px] font-medium text-gray-300">Image Generator</span>
      </div>

      {/* Style Presets */}
      <PanelSection title="Style">
        <div className="grid grid-cols-3 gap-1">
          {IMAGE_STYLES.map(({ style: s, label }) => (
            <button
              key={s}
              onClick={() => setStyle(style === s ? null : s)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 px-1 rounded-md text-[10px] font-medium truncate transition-all",
                style === s
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Aspect Ratio */}
      <PanelSection title="Aspect Ratio">
        <div className="flex bg-gray-800/50 rounded-lg p-[3px]">
          {ASPECT_RATIOS.map(({ ratio, label }) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              disabled={isGenerating || isApplying}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all",
                aspectRatio === ratio
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Remove Background */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Remove background</span>
        <Toggle
          checked={removeBackground}
          onChange={setRemoveBackground}
          disabled={isGenerating || isApplying}
          accentColor="green"
        />
      </div>

      {/* Advanced Options (Collapsible) */}
      <PanelSection title="Advanced" collapsible defaultOpen={false}>
        {/* Quality */}
        <div className="space-y-2">
          <span className="text-[10px] text-gray-500">Quality</span>
          <div className="flex bg-gray-800/50 rounded-lg p-[3px]">
            {IMAGE_QUALITY_OPTIONS.map(({ quality: q, label }) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                disabled={isGenerating || isApplying}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all",
                  quality === q
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-gray-600">High quality takes longer</p>
        </div>

        {/* Negative Prompt */}
        <div className="space-y-2 pt-3">
          <span className="text-[10px] text-gray-500">Negative Prompt</span>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="E.g., blurry, low quality, watermark..."
            disabled={isGenerating}
            rows={2}
            className={cn(
              "w-full px-3 py-2 rounded-lg resize-none",
              "bg-gray-800/60 border border-gray-700/50",
              "text-[11px] text-white placeholder:text-gray-500",
              "focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20",
              "transition-all duration-150"
            )}
          />
          <p className="text-[9px] text-gray-600">Describe what to avoid</p>
        </div>
      </PanelSection>

      <Divider label="generate with AI" />

      {/* AI Prompt */}
      <div className="space-y-2">
        <span className="text-[10px] text-gray-500">Describe the image</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., A modern office workspace with natural lighting and plants..."
          disabled={isGenerating}
          rows={4}
          className={cn(
            "w-full px-3 py-2 rounded-lg resize-none",
            "bg-gray-800/60 border border-gray-700/50",
            "text-[11px] text-white placeholder:text-gray-500",
            "focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20",
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
            : "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
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
            Generate Image
          </>
        )}
      </button>

      {/* Helper Text */}
      <p className="text-[9px] text-gray-600 text-center">
        AI generates images from your description
      </p>
    </div>
  )
}
