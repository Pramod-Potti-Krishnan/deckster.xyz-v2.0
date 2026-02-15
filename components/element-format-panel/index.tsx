"use client"

import { useState, useCallback } from 'react'
import { Trash2, Image, Table, BarChart3, LayoutGrid, GitBranch, Type, Layout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ElementFormatPanelProps } from './types'
import { ElementType, ELEMENT_INFO } from '@/types/elements'
import { ArrangeTab } from './tabs/arrange-tab'
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
  onClose,
  elementId,
  elementType,
  properties,
  onSendCommand,
  onDelete,
  presentationId,
  slideIndex = 0,
}: ElementFormatPanelProps) {
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

  // Render SlideFormatPanel when no element selected
  if (showSlidePanel) {
    return (
      <div
        className={cn(
          "absolute inset-0 bg-gray-900 text-white shadow-2xl z-20 flex flex-col"
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
    )
  }

  return (
    <div
      className={cn(
        "absolute inset-0 bg-gray-900 text-white shadow-2xl z-20 flex flex-col"
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

      {/* Arrange Content */}
      <div className="flex-1 overflow-y-auto">
        {properties && (
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
  )
}

export * from './types'
