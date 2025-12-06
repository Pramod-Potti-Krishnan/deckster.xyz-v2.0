"use client"

import { useState, useMemo } from 'react'
import { LayoutGrid, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseAITabProps } from '../types'
import {
  InfographicType,
  InfographicColorScheme,
  InfographicIconStyle,
  INFOGRAPHIC_TYPES,
  INFOGRAPHIC_COLOR_SCHEMES,
  INFOGRAPHIC_ICON_STYLES,
} from '@/types/elements'
import {
  PanelSection,
  Toggle,
  Divider,
} from '@/components/ui/panel'

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
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-purple-400" />
        <span className="text-[11px] font-medium text-gray-300">Infographic Generator</span>
      </div>

      {/* Infographic Type Selector - Grouped */}
      <PanelSection title="Type">
        <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
          {Object.entries(groupedInfographics).map(([group, infographics]) => (
            <div key={group} className="border border-gray-700/50 rounded-lg overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-800 text-[10px] font-medium text-gray-300 transition-colors"
              >
                <span>{group}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    expandedGroups.has(group) ? "rotate-180" : ""
                  )}
                />
              </button>
              {/* Group Content */}
              {expandedGroups.has(group) && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-900/50">
                  {infographics.map(({ type, label, description }) => (
                    <button
                      key={type}
                      onClick={() => handleInfographicTypeChange(type)}
                      disabled={isGenerating || isApplying}
                      className={cn(
                        "px-2 py-1.5 rounded-md text-[10px] font-medium transition-all text-left truncate",
                        infographicType === type
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
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
      </PanelSection>

      {/* Selected type indicator */}
      {selectedInfographic && (
        <div className="px-3 py-2 rounded-lg bg-purple-600/10 border border-purple-600/20 text-[10px] text-purple-300">
          <span className="font-medium">{selectedInfographic.label}</span>
          <span className="text-purple-400 ml-1">— {selectedInfographic.description}</span>
        </div>
      )}

      {/* Item Count Slider */}
      {showItemCount && (
        <PanelSection title="Item Count">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Number of items</span>
              <span className="text-[11px] text-purple-400 font-medium">{itemCount}</span>
            </div>
            <input
              type="range"
              min={3}
              max={10}
              value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value))}
              disabled={isGenerating || isApplying}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[9px] text-gray-600">
              <span>3</span>
              <span>10</span>
            </div>
          </div>
        </PanelSection>
      )}
      {infographicType && FIXED_COUNT_TYPES.includes(infographicType) && (
        <div className="px-3 py-2 bg-gray-800/60 rounded-lg text-[10px] text-gray-400">
          Item count is fixed for {selectedInfographic?.label}
        </div>
      )}

      {/* Color Scheme */}
      <PanelSection title="Color Scheme">
        <div className="grid grid-cols-5 gap-1">
          {INFOGRAPHIC_COLOR_SCHEMES.map(({ scheme, label }) => (
            <button
              key={scheme}
              onClick={() => setColorScheme(scheme)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 rounded-md text-[9px] font-medium transition-all truncate",
                colorScheme === scheme
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              )}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Icon Style */}
      <PanelSection title="Icon Style">
        <div className="grid grid-cols-4 gap-1">
          {INFOGRAPHIC_ICON_STYLES.map(({ style, label }) => (
            <button
              key={style}
              onClick={() => setIconStyle(style)}
              disabled={isGenerating || isApplying}
              className={cn(
                "py-1.5 rounded-md text-[10px] font-medium transition-all",
                iconStyle === style
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Include Descriptions Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Include descriptions</span>
        <Toggle
          checked={includeDescriptions}
          onChange={setIncludeDescriptions}
          disabled={isGenerating || isApplying}
          accentColor="purple"
        />
      </div>

      <Divider label="generate with AI" />

      {/* AI Prompt */}
      <div className="space-y-2">
        <span className="text-[10px] text-gray-500">Describe your infographic</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
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
          className={cn(
            "w-full px-3 py-2 rounded-lg resize-none",
            "bg-gray-800/60 border border-gray-700/50",
            "text-[11px] text-white placeholder:text-gray-500",
            "focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20",
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
        disabled={isGenerating || isApplying || !infographicType || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-10 rounded-lg",
          "text-[11px] font-medium transition-all duration-150",
          isGenerating || isApplying || !infographicType || !prompt.trim()
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20"
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
            Generate Infographic
          </>
        )}
      </button>

      {/* Helper Text */}
      <p className="text-[9px] text-gray-600 text-center">
        AI creates visual infographics from your description
      </p>
    </div>
  )
}
