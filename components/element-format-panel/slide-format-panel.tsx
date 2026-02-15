"use client"

import { useState, useMemo } from 'react'
import {
  Layout,
  Sparkles,
  Palette,
  Loader2,
  Plus,
  Copy,
  Trash2,
  Type,
  Table,
  BarChart3,
  LayoutGrid,
  GitBranch,
  Image,
  Columns,
  LayoutPanelLeft,
  ArrowLeftRight,
  Square,
  CheckCircle,
  Milestone,
} from 'lucide-react'
import { cn, normalizeColorToHex } from '@/lib/utils'
import { PromptInput } from './shared/prompt-input'
import {
  SlideLayoutType,
  SlideLayoutCategory,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_CATEGORIES,
  SLIDE_LAYOUT_FIELDS,
  SLIDE_LAYOUT_DEFAULTS,
} from '@/types/elements'
import {
  addSlide,
  changeSlideLayout,
  duplicateSlide,
  deleteSlide,
} from '@/lib/layout-service-client'

interface SlideFormatPanelProps {
  slideIndex: number
  presentationId: string
  onSendCommand: (command: string, payload: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
  isApplying?: boolean
  onSlideAdded?: () => void
  onSlideDeleted?: () => void
  onLayoutChanged?: () => void
}

type TabType = 'format' | 'add' | 'layout'

// Icon mapping for layout types
const LAYOUT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Sparkles': Sparkles,
  'Layout': Layout,
  'Milestone': Milestone,
  'CheckCircle': CheckCircle,
  'Type': Type,
  'Table': Table,
  'BarChart3': BarChart3,
  'LayoutGrid': LayoutGrid,
  'GitBranch': GitBranch,
  'Image': Image,
  'Columns': Columns,
  'LayoutPanelLeft': LayoutPanelLeft,
  'ArrowLeftRight': ArrowLeftRight,
  'Square': Square,
}

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
  onSlideAdded,
  onSlideDeleted,
  onLayoutChanged,
}: SlideFormatPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('add')

  // Format tab state
  const [backgroundColor, setBackgroundColor] = useState('#1a1a2e')
  const [selectedGradient, setSelectedGradient] = useState('none')
  const [backgroundOpacity, setBackgroundOpacity] = useState(100)

  // Add slide tab state
  const [selectedLayout, setSelectedLayout] = useState<SlideLayoutType>('C1-text')
  const [contentFields, setContentFields] = useState<Record<string, string>>({})
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Layout change tab state
  const [newLayout, setNewLayout] = useState<SlideLayoutType>('C1-text')

  // Get layouts grouped by category
  const layoutsByCategory = useMemo(() => {
    const grouped: Record<SlideLayoutCategory, typeof SLIDE_LAYOUTS> = {
      hero: [],
      content: [],
      split: [],
      blank: [],
    }
    SLIDE_LAYOUTS.forEach((layout) => {
      grouped[layout.category].push(layout)
    })
    return grouped
  }, [])

  // Get the selected layout info
  const selectedLayoutInfo = SLIDE_LAYOUTS.find(l => l.layout === selectedLayout)
  const isAILayout = selectedLayout === 'H1-generated'

  // Get content fields for selected layout
  const fields = SLIDE_LAYOUT_FIELDS[selectedLayout] || []

  // Update a content field
  const handleFieldChange = (key: string, value: string) => {
    setContentFields(prev => ({ ...prev, [key]: value }))
  }

  // Apply background formatting
  const handleApplyFormat = async () => {
    setError(null)
    setIsProcessing(true)
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
    } finally {
      setIsProcessing(false)
    }
  }

  // Add a new slide
  const handleAddSlide = async () => {
    setError(null)
    setIsProcessing(true)

    try {
      // For AI-generated slides, use Elementor
      if (isAILayout && prompt.trim()) {
        const result = await onSendCommand('generateHeroSlide', {
          prompt: prompt.trim(),
          layout: selectedLayout,
          slideIndex: slideIndex + 1, // Add after current slide
          presentationId,
        })

        if (result.success) {
          setPrompt('')
          onSlideAdded?.()
        } else {
          setError(result.error || 'Failed to generate slide')
        }
      } else {
        // For manual slides, use Layout Service
        const content = {
          ...SLIDE_LAYOUT_DEFAULTS[selectedLayout],
          ...contentFields,
        }

        const result = await addSlide(presentationId, selectedLayout, {
          position: slideIndex + 1, // Add after current slide
          content,
        })

        if (result.success) {
          setContentFields({})
          onSlideAdded?.()
        } else {
          setError(result.error?.message || 'Failed to add slide')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slide')
    } finally {
      setIsProcessing(false)
    }
  }

  // Duplicate current slide
  const handleDuplicateSlide = async () => {
    setError(null)
    setIsProcessing(true)

    try {
      const result = await duplicateSlide(presentationId, slideIndex)
      if (result.success) {
        onSlideAdded?.()
      } else {
        setError(result.error?.message || 'Failed to duplicate slide')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate slide')
    } finally {
      setIsProcessing(false)
    }
  }

  // Delete current slide
  const handleDeleteSlide = async () => {
    setError(null)
    setIsProcessing(true)

    try {
      const result = await deleteSlide(presentationId, slideIndex)
      if (result.success) {
        onSlideDeleted?.()
      } else {
        setError(result.error?.message || 'Failed to delete slide')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slide')
    } finally {
      setIsProcessing(false)
    }
  }

  // Change slide layout
  const handleChangeLayout = async () => {
    setError(null)
    setIsProcessing(true)

    try {
      const result = await changeSlideLayout(presentationId, slideIndex, newLayout, {
        preserve_content: true,
      })
      if (result.success) {
        onLayoutChanged?.()
      } else {
        setError(result.error?.message || 'Failed to change layout')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change layout')
    } finally {
      setIsProcessing(false)
    }
  }

  // Render layout selector grid
  const renderLayoutSelector = (
    selectedValue: SlideLayoutType,
    onSelect: (layout: SlideLayoutType) => void,
    compact: boolean = false
  ) => (
    <div className="space-y-3">
      {SLIDE_LAYOUT_CATEGORIES.map(({ category, label }) => {
        const layouts = layoutsByCategory[category]
        if (layouts.length === 0) return null

        return (
          <div key={category} className="space-y-1.5">
            <label className="text-xs text-gray-500 uppercase tracking-wide">{label}</label>
            <div className={cn(
              "grid gap-1.5",
              compact ? "grid-cols-4" : "grid-cols-3"
            )}>
              {layouts.map(({ layout, label: layoutLabel, description, icon }) => {
                const IconComponent = icon ? LAYOUT_ICONS[icon] : Layout
                const isSelected = selectedValue === layout

                return (
                  <button
                    key={layout}
                    onClick={() => onSelect(layout)}
                    disabled={isProcessing || isApplying}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all",
                      "hover:border-teal-500/50 hover:bg-gray-800/50",
                      isSelected
                        ? "border-teal-500 bg-teal-500/10"
                        : "border-gray-700 bg-gray-800/30",
                      compact && "p-1.5"
                    )}
                    title={description}
                  >
                    {IconComponent && (
                      <IconComponent className={cn(
                        "text-gray-400",
                        isSelected && "text-teal-400",
                        compact ? "h-4 w-4" : "h-5 w-5 mb-1"
                      )} />
                    )}
                    {!compact && (
                      <span className={cn(
                        "text-[10px] text-center leading-tight",
                        isSelected ? "text-teal-300" : "text-gray-400"
                      )}>
                        {layoutLabel}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  // Render content field input
  const renderContentField = (field: typeof fields[0]) => {
    const value = contentFields[field.key] || ''

    switch (field.type) {
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeColorToHex(value, '#1e3a5f')}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              disabled={isProcessing}
              className="w-10 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={value || '#1e3a5f'}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              disabled={isProcessing}
              className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 font-mono"
              placeholder={field.placeholder}
            />
          </div>
        )

      case 'textarea':
      case 'richtext':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={isProcessing}
            rows={field.rows || 3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 resize-none focus:outline-none focus:border-teal-500"
            placeholder={field.placeholder}
          />
        )

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={isProcessing}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-teal-500"
            placeholder={field.placeholder}
          />
        )
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-400">
            <Layout className="h-4 w-4" />
            <span className="text-sm font-medium">Slide {slideIndex + 1}</span>
          </div>
          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDuplicateSlide}
              disabled={isProcessing || isApplying}
              className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Duplicate slide"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDeleteSlide}
              disabled={isProcessing || isApplying}
              className="p-1.5 rounded hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete slide"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="px-3 pt-3">
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('add')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
              activeTab === 'add'
                ? "bg-teal-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
              activeTab === 'layout'
                ? "bg-teal-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Layout
          </button>
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
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Error Message */}
        {error && (
          <div className="px-2 py-1.5 bg-red-600/20 border border-red-500 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        {activeTab === 'add' && (
          <>
            {/* Layout Selector */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Choose Layout</label>
              {renderLayoutSelector(selectedLayout, setSelectedLayout)}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">
                {isAILayout ? 'AI Generation' : 'Content'}
              </span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Content Fields or AI Prompt */}
            {isAILayout ? (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Describe your title slide</label>
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  placeholder="E.g., Q4 2024 Business Review - Driving Growth Through Innovation"
                  disabled={isProcessing}
                  rows={3}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs text-gray-400">{field.label}</label>
                    {renderContentField(field)}
                  </div>
                ))}
              </div>
            )}

            {/* Add Slide Button */}
            <button
              onClick={handleAddSlide}
              disabled={isProcessing || isApplying || (isAILayout && !prompt.trim())}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isProcessing || isApplying || (isAILayout && !prompt.trim())
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAILayout ? 'Generating...' : 'Adding...'}
                </>
              ) : (
                <>
                  {isAILayout ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Add {selectedLayoutInfo?.label || 'Slide'}
                </>
              )}
            </button>

            {/* Info Text */}
            <p className="text-xs text-gray-500 text-center">
              {isAILayout
                ? 'AI will generate a beautiful title slide based on your description'
                : `Adds a new ${selectedLayoutInfo?.label?.toLowerCase() || 'slide'} after the current slide`
              }
            </p>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            {/* Layout Change Info */}
            <div className="text-xs text-gray-400 mb-2">
              Change the layout of the current slide. Content will be preserved where possible.
            </div>

            {/* Layout Selector */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide">New Layout</label>
              {renderLayoutSelector(newLayout, setNewLayout, true)}
            </div>

            {/* Change Layout Button */}
            <button
              onClick={handleChangeLayout}
              disabled={isProcessing || isApplying}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors mt-4",
                isProcessing || isApplying
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  Apply Layout
                </>
              )}
            </button>
          </>
        )}

        {activeTab === 'format' && (
          <>
            {/* Background Color */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  disabled={isApplying || isProcessing}
                  className="w-10 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  disabled={isApplying || isProcessing}
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
                    disabled={isApplying || isProcessing}
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
                disabled={isApplying || isProcessing}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyFormat}
              disabled={isApplying || isProcessing}
              className={cn(
                "w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
                isApplying || isProcessing
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              )}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </span>
              ) : (
                'Apply Background'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
