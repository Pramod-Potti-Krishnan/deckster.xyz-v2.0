"use client"

import { useState, useMemo } from 'react'
import { LayoutGrid, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import { PromptInput } from '../shared/prompt-input'
import {
  InfographicType,
  InfographicColorScheme,
  InfographicIconStyle,
  INFOGRAPHIC_TYPES,
  INFOGRAPHIC_COLOR_SCHEMES,
  INFOGRAPHIC_ICON_STYLES,
} from '@/types/elements'

// Infographics where item count doesn't apply (fixed layout)
const FIXED_COUNT_TYPES: InfographicType[] = ['concept_spread'] // Fixed at 6 hexagons

// Group infographic types by their group property
function groupInfographicTypes() {
  const groups: Record<string, typeof INFOGRAPHIC_TYPES> = {}
  for (const infographic of INFOGRAPHIC_TYPES) {
    if (!groups[infographic.group]) {
      groups[infographic.group] = []
    }
    groups[infographic.group].push(infographic)
  }
  return groups
}

export function InfographicAITab({
  onSendCommand,
  isApplying,
  elementId,
  presentationId,
  slideIndex,
}: BaseAITabProps) {
  const [infographicType, setInfographicType] = useState<InfographicType | null>(null)
  const [itemCount, setItemCount] = useState(5)
  const [colorScheme, setColorScheme] = useState<InfographicColorScheme>('professional')
  const [iconStyle, setIconStyle] = useState<InfographicIconStyle>('emoji')
  const [includeDescriptions, setIncludeDescriptions] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Sequential', 'Comparative']))

  // Group infographic types
  const groupedInfographics = useMemo(() => groupInfographicTypes(), [])

  // Get selected infographic info
  const selectedInfographic = useMemo(
    () => INFOGRAPHIC_TYPES.find(i => i.type === infographicType),
    [infographicType]
  )

  // Check if item count selector should be shown
  const showItemCount = infographicType && !FIXED_COUNT_TYPES.includes(infographicType)

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(group)) {
        newSet.delete(group)
      } else {
        newSet.add(group)
      }
      return newSet
    })
  }

  // Handle infographic type selection
  const handleInfographicTypeChange = async (type: InfographicType) => {
    setInfographicType(type)
    try {
      await onSendCommand('setInfographicType', {
        elementId,
        type,
      })
    } catch (err) {
      // Silently handle - UI update is enough
    }
  }

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
        itemCount: showItemCount ? itemCount : undefined,
        colorScheme,
        iconStyle,
        includeDescriptions,
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

      {/* Infographic Type Selector - Grouped */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Type</label>
        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
          {Object.entries(groupedInfographics).map(([group, infographics]) => (
            <div key={group} className="border border-gray-700 rounded-md overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800 hover:bg-gray-750 text-xs font-medium text-gray-300"
              >
                <span>{group}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    expandedGroups.has(group) ? "rotate-180" : ""
                  )}
                />
              </button>
              {/* Group Content */}
              {expandedGroups.has(group) && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-900">
                  {infographics.map(({ type, label, description }) => (
                    <button
                      key={type}
                      onClick={() => handleInfographicTypeChange(type)}
                      disabled={isGenerating || isApplying}
                      className={cn(
                        "px-2 py-1.5 rounded text-xs font-medium transition-colors text-left truncate",
                        infographicType === type
                          ? "bg-purple-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      )}
                      title={description}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected type indicator */}
      {selectedInfographic && (
        <div className="px-2 py-1.5 bg-purple-600/10 border border-purple-600/30 rounded text-xs text-purple-300">
          <span className="font-medium">{selectedInfographic.label}</span>
          <span className="text-purple-400 ml-1">— {selectedInfographic.description}</span>
        </div>
      )}

      {/* Item Count Slider */}
      {showItemCount && (
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Item Count</label>
            <span className="text-xs text-purple-400 font-medium">{itemCount}</span>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            value={itemCount}
            onChange={(e) => setItemCount(Number(e.target.value))}
            disabled={isGenerating || isApplying}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>3</span>
            <span>10</span>
          </div>
        </div>
      )}
      {infographicType && FIXED_COUNT_TYPES.includes(infographicType) && (
        <div className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
          Item count is fixed for {selectedInfographic?.label}
        </div>
      )}

      {/* Color Scheme */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Color Scheme</label>
        <div className="grid grid-cols-5 gap-1">
          {INFOGRAPHIC_COLOR_SCHEMES.map(({ scheme, label }) => (
            <button
              key={scheme}
              onClick={() => setColorScheme(scheme)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 rounded text-[10px] font-medium transition-colors truncate",
                colorScheme === scheme
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Style */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Icon Style</label>
        <div className="grid grid-cols-4 gap-1">
          {INFOGRAPHIC_ICON_STYLES.map(({ style, label }) => (
            <button
              key={style}
              onClick={() => setIconStyle(style)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 rounded text-xs font-medium transition-colors",
                iconStyle === style
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Include Descriptions Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">Include descriptions</label>
        <button
          onClick={() => setIncludeDescriptions(!includeDescriptions)}
          disabled={isGenerating || isApplying}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            includeDescriptions ? "bg-purple-600" : "bg-gray-700"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
              includeDescriptions ? "translate-x-5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500">generate with AI</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* AI Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-400">Describe your infographic</label>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder={
            infographicType === 'timeline'
              ? "E.g., Company milestones from 2020 to 2024..."
              : infographicType === 'process'
              ? "E.g., 5-step customer onboarding process..."
              : infographicType === 'comparison'
              ? "E.g., Compare Plan A vs Plan B features..."
              : infographicType === 'statistics'
              ? "E.g., Key metrics: 50% growth, 1M users..."
              : infographicType === 'pyramid'
              ? "E.g., Maslow's hierarchy of needs..."
              : infographicType === 'funnel'
              ? "E.g., Sales funnel: Awareness to Conversion..."
              : infographicType === 'concentric_circles'
              ? "E.g., Core values surrounded by supporting practices..."
              : infographicType === 'concept_spread'
              ? "E.g., Six key pillars of our strategy..."
              : "Describe the content you want to visualize..."
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
