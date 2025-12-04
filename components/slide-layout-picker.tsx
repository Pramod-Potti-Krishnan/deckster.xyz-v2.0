"use client"

import { useState, useMemo } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Plus,
  Type,
  Layout,
  Columns,
  Image,
  Table,
  BarChart3,
  LayoutGrid,
  GitBranch,
  Sparkles,
  Milestone,
  CheckCircle,
  LayoutPanelLeft,
  ArrowLeftRight,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SlideLayoutType,
  SlideLayoutCategory,
  SLIDE_LAYOUTS as SLIDE_LAYOUT_DEFINITIONS,
  SLIDE_LAYOUT_CATEGORIES,
} from '@/types/elements'

// Re-export the type for backward compatibility
export type { SlideLayoutType }

// Legacy type alias for backward compatibility
export type SlideLayoutId = SlideLayoutType

export interface SlideLayout {
  id: SlideLayoutType
  name: string
  description: string
  icon: React.ReactNode
  category: SlideLayoutCategory
}

// Icon mapping with size variants
const getLayoutIcon = (iconName: string | undefined, size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'

  const icons: Record<string, React.ReactNode> = {
    'Sparkles': <Sparkles className={sizeClass} />,
    'Layout': <Layout className={sizeClass} />,
    'Milestone': <Milestone className={sizeClass} />,
    'CheckCircle': <CheckCircle className={sizeClass} />,
    'Type': <Type className={sizeClass} />,
    'Table': <Table className={sizeClass} />,
    'BarChart3': <BarChart3 className={sizeClass} />,
    'LayoutGrid': <LayoutGrid className={sizeClass} />,
    'GitBranch': <GitBranch className={sizeClass} />,
    'Image': <Image className={sizeClass} />,
    'Columns': <Columns className={sizeClass} />,
    'LayoutPanelLeft': <LayoutPanelLeft className={sizeClass} />,
    'ArrowLeftRight': <ArrowLeftRight className={sizeClass} />,
    'Square': <Square className={sizeClass} />,
  }

  return iconName && icons[iconName] ? icons[iconName] : <Layout className={sizeClass} />
}

// Build slide layouts from type definitions
export const SLIDE_LAYOUTS: SlideLayout[] = SLIDE_LAYOUT_DEFINITIONS.map(def => ({
  id: def.layout,
  name: def.label,
  description: def.description,
  icon: getLayoutIcon(def.icon, 'md'),
  category: def.category,
}))

// Get layouts by category
const getLayoutsByCategory = (category: SlideLayoutCategory): typeof SLIDE_LAYOUT_DEFINITIONS => {
  return SLIDE_LAYOUT_DEFINITIONS.filter(l => l.category === category)
}

interface SlideLayoutPickerProps {
  onAddSlide: (layoutId: SlideLayoutType) => Promise<void>
  disabled?: boolean
  className?: string
}

/**
 * SlideLayoutPicker Component
 *
 * Popover with grid layout for adding new slides.
 * Supports 15 layout types aligned with Layout Service v7.5.
 */
export function SlideLayoutPicker({
  onAddSlide,
  disabled = false,
  className = '',
}: SlideLayoutPickerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [open, setOpen] = useState(false)

  const handleSelectLayout = async (layoutId: SlideLayoutType) => {
    setIsAdding(true)
    setOpen(false)
    try {
      await onAddSlide(layoutId)
    } finally {
      setIsAdding(false)
    }
  }

  // Group layouts by category
  const layoutsByCategory = useMemo(() => ({
    hero: getLayoutsByCategory('hero'),
    content: getLayoutsByCategory('content'),
    split: getLayoutsByCategory('split'),
    blank: getLayoutsByCategory('blank'),
  }), [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || isAdding}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1 rounded",
            "hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
            className
          )}
        >
          <Plus className="h-5 w-5 text-gray-700" />
          <span className="text-[10px] text-gray-500">{isAdding ? 'Adding' : 'Add Slide'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] p-4"
        sideOffset={8}
      >
        <div className="space-y-4">
          {/* Hero Slides - 4 items in a row */}
          <div>
            <h4 className="text-xs font-medium text-amber-600 mb-2 px-1">Hero Slides</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.hero.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-amber-400 hover:bg-amber-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Slides - 6 items in 2 rows of 3 */}
          <div>
            <h4 className="text-xs font-medium text-blue-600 mb-2 px-1">Content Slides</h4>
            <div className="grid grid-cols-3 gap-2">
              {layoutsByCategory.content.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-blue-400 hover:bg-blue-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Split Slides - 4 items in a row */}
          <div>
            <h4 className="text-xs font-medium text-purple-600 mb-2 px-1">Split Layouts</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.split.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-purple-400 hover:bg-purple-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Blank Slide - single item */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 px-1">Other</h4>
            <div className="grid grid-cols-4 gap-2">
              {layoutsByCategory.blank.map((layout) => (
                <button
                  key={layout.layout}
                  onClick={() => handleSelectLayout(layout.layout)}
                  disabled={isAdding}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                    "border border-gray-200 bg-white",
                    "hover:border-gray-400 hover:bg-gray-50",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={layout.description}
                >
                  <div className="w-full aspect-[16/10] rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                    {getLayoutIcon(layout.icon, 'md')}
                  </div>
                  <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Legacy mapping for backward compatibility (old L01, L02 etc. to new layout IDs)
export const LEGACY_LAYOUT_MAP: Record<string, SlideLayoutType> = {
  'L01': 'H1-structured',  // Title Slide
  'L02': 'H2-section',     // Section Header
  'L03': 'C1-text',        // Content
  'L25': 'S1-visual-text', // Two Column
  'L27': 'C6-image',       // Image Focus
  'L29': 'H1-generated',   // Hero
}

// Helper to convert legacy layout ID to new format
export function convertLegacyLayoutId(legacyId: string): SlideLayoutType {
  return LEGACY_LAYOUT_MAP[legacyId] || 'C1-text'
}
