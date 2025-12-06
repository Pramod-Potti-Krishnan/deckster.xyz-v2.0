"use client"

import { useState, useCallback } from 'react'
import { Trash2, ChevronLeft, ChevronRight, Image, Table, BarChart3, LayoutGrid, GitBranch, Type, Layout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ElementFormatPanelProps, PanelTabType } from './types'
import { ElementType, ELEMENT_INFO } from '@/types/elements'
import { ArrangeTab } from './tabs/arrange-tab'
import { ImageAITab } from './ai-tabs/image-ai-tab'
import { TableAITab } from './ai-tabs/table-ai-tab'
import { ChartAITab } from './ai-tabs/chart-ai-tab'
import { InfographicAITab } from './ai-tabs/infographic-ai-tab'
import { DiagramAITab } from './ai-tabs/diagram-ai-tab'
import { SlideFormatPanel } from './slide-format-panel'

// Map element types to their icons
const ELEMENT_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  image: Image,
  table: Table,
  chart: BarChart3,
  infographic: LayoutGrid,
  diagram: GitBranch,
  text: Type,
  hero: Layout,
}

// Map element types to their accent colors
const ELEMENT_ACCENT_COLORS: Record<ElementType, string> = {
  image: 'text-green-400',
  table: 'text-blue-400',
  chart: 'text-amber-400',
  infographic: 'text-purple-400',
  diagram: 'text-pink-400',
  text: 'text-indigo-400',
  hero: 'text-teal-400',
}

export function ElementFormatPanel({
  isOpen,
  isCollapsed,
  onCollapsedChange,
  onClose,
  elementId,
  elementType,
  properties,
  onSendCommand,
  onDelete,
  presentationId,
  slideIndex = 0,
}: ElementFormatPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTabType>('ai')
  const [isApplying, setIsApplying] = useState(false)

  // Wrapper for sending commands with loading state
  const handleSendCommand = useCallback(async (action: string, params: Record<string, unknown>) => {
    setIsApplying(true)
    try {
      const result = await onSendCommand(action, { ...params, elementId })
      return result
    } finally {
      setIsApplying(false)
    }
  }, [onSendCommand, elementId])

  // Wrapper for slide commands (no elementId needed)
  const handleSlideCommand = useCallback(async (action: string, params: Record<string, unknown>) => {
    setIsApplying(true)
    try {
      const result = await onSendCommand(action, params)
      return result
    } finally {
      setIsApplying(false)
    }
  }, [onSendCommand])

  // Don't render if not open
  if (!isOpen) return null

  // Check if no element is selected - show SlideFormatPanel instead
  const showSlidePanel = !elementId || !elementType

  // Get element info for display
  const elementInfo = elementType ? ELEMENT_INFO[elementType] : null
  const ElementIcon = elementType ? ELEMENT_ICONS[elementType] : null
  const accentColor = elementType ? ELEMENT_ACCENT_COLORS[elementType] : 'text-gray-400'

  // Get the appropriate tab label based on element type
  const getAITabLabel = () => {
    switch (elementType) {
      case 'image':
        return 'Generate'
      case 'table':
        return 'Text/Table'
      case 'chart':
        return 'Chart'
      case 'infographic':
        return 'Design'
      case 'diagram':
        return 'Diagram'
      case 'text':
        return 'Text'
      case 'hero':
        return 'Hero'
      default:
        return 'AI'
    }
  }

  // Render the appropriate AI tab based on element type
  const renderAITab = () => {
    if (!elementType || !elementId) return null

    const commonProps = {
      onSendCommand: handleSendCommand,
      isApplying,
      elementId,
      presentationId,
      slideIndex,
    }

    switch (elementType) {
      case 'image':
        return <ImageAITab {...commonProps} />
      case 'table':
      case 'text':
        return <TableAITab {...commonProps} />
      case 'chart':
        return <ChartAITab {...commonProps} />
      case 'infographic':
        return <InfographicAITab {...commonProps} />
      case 'diagram':
        return <DiagramAITab {...commonProps} />
      default:
        return null
    }
  }

  // Render SlideFormatPanel when no element selected
  if (showSlidePanel) {
    return (
      <>
        {/* Slide Panel Container */}
        <div
          className={cn(
            "absolute inset-0 bg-gray-900 text-white shadow-2xl z-20 flex flex-col",
            "transform transition-transform duration-200 ease-out",
            isCollapsed ? "-translate-x-full" : "translate-x-0"
          )}
        >
          <SlideFormatPanel
            slideIndex={slideIndex}
            presentationId={presentationId || ''}
            onSendCommand={handleSlideCommand}
            isApplying={isApplying}
          />

          {/* Applying indicator - refined */}
          {isApplying && (
            <div className={cn(
              "absolute bottom-4 left-1/2 -translate-x-1/2",
              "px-4 py-2 bg-teal-600 rounded-full",
              "text-[11px] font-medium text-white shadow-lg"
            )}>
              Applying...
            </div>
          )}
        </div>

        {/* Collapse/Expand toggle - refined */}
        <button
          onClick={() => onCollapsedChange(!isCollapsed)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-30",
            "w-5 h-14 bg-gray-800 hover:bg-gray-700",
            "rounded-r-md shadow-lg",
            "flex items-center justify-center",
            "border-y border-r border-gray-700",
            "transition-all duration-150",
            isCollapsed ? "left-0" : "right-0 translate-x-full"
          )}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </>
    )
  }

  return (
    <>
      {/* Panel Container */}
      <div
        className={cn(
          "absolute inset-0 bg-gray-900 text-white shadow-2xl z-20 flex flex-col",
          "transform transition-transform duration-200 ease-out",
          isCollapsed ? "-translate-x-full" : "translate-x-0"
        )}
      >
        {/* Header - Refined with icon and better spacing */}
        <div className="flex items-center justify-between h-11 px-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {ElementIcon && (
              <ElementIcon className={cn("h-4 w-4", accentColor)} />
            )}
            <h2 className="text-[13px] font-medium text-white">
              {elementInfo?.label || 'Element'}
            </h2>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-md",
                "text-gray-500 hover:text-red-400 hover:bg-red-500/10",
                "transition-colors"
              )}
              title="Delete element"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab Switcher - Keynote-style segmented control */}
        <div className="px-4 pt-3">
          <div className="flex h-8 bg-gray-800/50 rounded-lg p-[3px]">
            <button
              onClick={() => setActiveTab('ai')}
              className={cn(
                "flex-1 flex items-center justify-center rounded-md",
                "text-[11px] font-medium transition-all duration-150",
                activeTab === 'ai'
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              {getAITabLabel()}
            </button>
            <button
              onClick={() => setActiveTab('arrange')}
              className={cn(
                "flex-1 flex items-center justify-center rounded-md",
                "text-[11px] font-medium transition-all duration-150",
                activeTab === 'arrange'
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              Arrange
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'ai' && renderAITab()}
          {activeTab === 'arrange' && properties && (
            <ArrangeTab
              properties={properties}
              onSendCommand={handleSendCommand}
              isApplying={isApplying}
              elementId={elementId || ''}
            />
          )}
        </div>

        {/* Applying indicator - refined */}
        {isApplying && (
          <div className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2",
            "px-4 py-2 bg-blue-600 rounded-full",
            "text-[11px] font-medium text-white shadow-lg"
          )}>
            Applying...
          </div>
        )}
      </div>

      {/* Collapse/Expand toggle - refined */}
      <button
        onClick={() => onCollapsedChange(!isCollapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30",
          "w-5 h-14 bg-gray-800 hover:bg-gray-700",
          "rounded-r-md shadow-lg",
          "flex items-center justify-center",
          "border-y border-r border-gray-700",
          "transition-all duration-150",
          isCollapsed ? "left-0" : "right-0 translate-x-full"
        )}
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        )}
      </button>
    </>
  )
}

export * from './types'
