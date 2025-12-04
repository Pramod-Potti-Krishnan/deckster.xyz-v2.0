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

          {/* Applying indicator */}
          {isApplying && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-teal-600 rounded-full text-xs">
              Applying...
            </div>
          )}
        </div>

        {/* Collapse/Expand arrow tab */}
        <button
          onClick={() => onCollapsedChange(!isCollapsed)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-30",
            "w-6 h-16 bg-gray-800 hover:bg-gray-700",
            "rounded-r-lg shadow-lg",
            "flex items-center justify-center",
            "border-y border-r border-gray-600",
            "transition-all duration-200",
            isCollapsed ? "left-0" : "right-0 translate-x-full"
          )}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-300" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-300" />
          )}
        </button>
      </>
    )
  }

  return (
    <>
      {/* Panel Container - Absolute positioned, fully hidden when collapsed */}
      <div
        className={cn(
          "absolute inset-0 bg-gray-900 text-white shadow-2xl z-20 flex flex-col",
          "transform transition-transform duration-200 ease-out",
          isCollapsed ? "-translate-x-full" : "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {ElementIcon && (
              <ElementIcon
                className={cn(
                  "h-4 w-4",
                  elementType === 'image' && "text-green-400",
                  elementType === 'table' && "text-blue-400",
                  elementType === 'chart' && "text-amber-400",
                  elementType === 'infographic' && "text-purple-400",
                  elementType === 'diagram' && "text-pink-400",
                  elementType === 'text' && "text-indigo-400",
                  elementType === 'hero' && "text-teal-400"
                )}
              />
            )}
            <h2 className="text-sm font-semibold">
              {elementInfo?.label || 'Element'}
            </h2>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
              title="Delete element"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tab Headers - Keynote-style segmented control */}
        <div className="flex mx-4 mt-3 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'ai'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            {getAITabLabel()}
          </button>
          <button
            onClick={() => setActiveTab('arrange')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'arrange'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Arrange
          </button>
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

        {/* Applying indicator */}
        {isApplying && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-600 rounded-full text-xs">
            Applying...
          </div>
        )}
      </div>

      {/* Collapse/Expand arrow tab - fixed position, always visible on right edge */}
      <button
        onClick={() => onCollapsedChange(!isCollapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30",
          "w-6 h-16 bg-gray-800 hover:bg-gray-700",
          "rounded-r-lg shadow-lg",
          "flex items-center justify-center",
          "border-y border-r border-gray-600",
          "transition-all duration-200",
          isCollapsed ? "left-0" : "right-0 translate-x-full"
        )}
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5 text-gray-300" />
        ) : (
          <ChevronLeft className="h-5 w-5 text-gray-300" />
        )}
      </button>
    </>
  )
}

export * from './types'
