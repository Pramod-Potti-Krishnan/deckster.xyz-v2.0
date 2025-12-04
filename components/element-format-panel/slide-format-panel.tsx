"use client"

import { useState } from 'react'
import { Layout, Sparkles, Palette, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PromptInput } from './shared/prompt-input'
import {
  HeroType,
  HeroVisualStyle,
  HERO_TYPES,
  HERO_VISUAL_STYLES,
} from '@/types/elements'

interface SlideFormatPanelProps {
  slideIndex: number
  presentationId: string
  onSendCommand: (command: string, payload: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
  isApplying?: boolean
}

type TabType = 'format' | 'generate'

// Background gradient presets
const GRADIENT_PRESETS = [
  { name: 'None', value: 'none', style: '' },
  { name: 'Blue', value: 'blue', style: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset', value: 'sunset', style: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Ocean', value: 'ocean', style: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Forest', value: 'forest', style: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Dark', value: 'dark', style: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'Warm', value: 'warm', style: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
]

export function SlideFormatPanel({
  slideIndex,
  presentationId,
  onSendCommand,
  isApplying = false,
}: SlideFormatPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('format')

  // Format tab state
  const [backgroundColor, setBackgroundColor] = useState('#1a1a2e')
  const [selectedGradient, setSelectedGradient] = useState('none')
  const [backgroundOpacity, setBackgroundOpacity] = useState(100)

  // Generate tab state
  const [heroType, setHeroType] = useState<HeroType>('title')
  const [visualStyle, setVisualStyle] = useState<HeroVisualStyle>('professional')
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if the selected hero type has an image
  const selectedHeroInfo = HERO_TYPES.find(h => h.type === heroType)
  const hasImage = selectedHeroInfo?.hasImage ?? false

  // Apply background formatting
  const handleApplyFormat = async () => {
    try {
      await onSendCommand('setSlideBackground', {
        slideIndex,
        backgroundColor,
        gradient: selectedGradient !== 'none' ? GRADIENT_PRESETS.find(g => g.value === selectedGradient)?.style : undefined,
        opacity: backgroundOpacity / 100,
        presentationId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply formatting')
    }
  }

  // Generate hero slide
  const handleGenerateHero = async () => {
    if (!prompt.trim()) {
      setError('Please describe the slide content')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const result = await onSendCommand('generateHeroSlide', {
        prompt: prompt.trim(),
        heroType,
        visualStyle: hasImage ? visualStyle : undefined,
        slideIndex,
        presentationId,
      })

      if (result.success) {
        setPrompt('')
      } else {
        setError(result.error || 'Failed to generate hero slide')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate hero slide')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center gap-2 text-teal-400">
          <Layout className="h-4 w-4" />
          <span className="text-sm font-medium">Slide {slideIndex + 1}</span>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="px-3 pt-3">
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('format')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
              activeTab === 'format'
                ? "bg-teal-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Palette className="h-3.5 w-3.5" />
            Format
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
              activeTab === 'generate'
                ? "bg-teal-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === 'format' ? (
          <>
            {/* Background Color */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  disabled={isApplying}
                  className="w-10 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  disabled={isApplying}
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 font-mono"
                  placeholder="#1a1a2e"
                />
              </div>
            </div>

            {/* Gradient Presets */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Gradient</label>
              <div className="grid grid-cols-4 gap-1.5">
                {GRADIENT_PRESETS.map(({ name, value, style }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedGradient(value)}
                    disabled={isApplying}
                    className={cn(
                      "aspect-square rounded-md border-2 transition-all overflow-hidden",
                      selectedGradient === value
                        ? "border-teal-500 scale-105"
                        : "border-gray-700 hover:border-gray-600"
                    )}
                    title={name}
                  >
                    {style ? (
                      <div className="w-full h-full" style={{ background: style }} />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[10px] text-gray-500">
                        None
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs text-gray-400 uppercase tracking-wide">Opacity</label>
                <span className="text-xs text-teal-400 font-medium">{backgroundOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={backgroundOpacity}
                onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                disabled={isApplying}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyFormat}
              disabled={isApplying}
              className={cn(
                "w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
                isApplying
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              )}
            >
              Apply Background
            </button>
          </>
        ) : (
          <>
            {/* Hero Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Slide Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {HERO_TYPES.map(({ type, label, hasImage: typeHasImage }) => (
                  <button
                    key={type}
                    onClick={() => setHeroType(type)}
                    disabled={isGenerating || isApplying}
                    className={cn(
                      "px-2 py-2 rounded-md text-xs font-medium transition-colors text-left",
                      heroType === type
                        ? "bg-teal-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    )}
                  >
                    <span className="block truncate">{label}</span>
                    {typeHasImage && (
                      <span className="text-[10px] opacity-70">+ Image</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Style (only for image types) */}
            {hasImage && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 uppercase tracking-wide">Visual Style</label>
                <div className="grid grid-cols-3 gap-1">
                  {HERO_VISUAL_STYLES.map(({ style, label }) => (
                    <button
                      key={style}
                      onClick={() => setVisualStyle(style)}
                      disabled={isGenerating || isApplying}
                      className={cn(
                        "py-1.5 rounded text-xs font-medium transition-colors",
                        visualStyle === style
                          ? "bg-teal-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">generate with AI</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">
                {heroType.includes('title')
                  ? 'Presentation title and subtitle'
                  : heroType.includes('section')
                  ? 'Section topic or theme'
                  : 'Closing message or call-to-action'}
              </label>
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                placeholder={
                  heroType === 'title' || heroType === 'title_with_image'
                    ? "E.g., Q4 2024 Business Review - Driving Growth Through Innovation"
                    : heroType === 'section' || heroType === 'section_with_image'
                    ? "E.g., Market Analysis - Competitive Landscape"
                    : "E.g., Thank you! Questions? Contact us at..."
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
              onClick={handleGenerateHero}
              disabled={isGenerating || isApplying || !prompt.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isGenerating || isApplying || !prompt.trim()
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
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
                  Generate Slide
                </>
              )}
            </button>

            {/* Info Text */}
            <p className="text-xs text-gray-500 text-center">
              AI will generate a {selectedHeroInfo?.label.toLowerCase() || 'slide'} based on your description
            </p>
          </>
        )}
      </div>
    </div>
  )
}
