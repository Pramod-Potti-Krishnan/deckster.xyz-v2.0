"use client"

import { useState, useCallback } from 'react'
import { Trash2, ChevronLeft, ChevronRight, Type } from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { StyleTab } from './style-tab'
import { AITab } from './ai-tab'
import { cn } from '@/lib/utils'

export interface TextBoxFormatPanelProps {
  isOpen: boolean
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onClose: () => void
  elementId: string | null
  formatting: TextBoxFormatting | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  onDelete?: () => void
  presentationId?: string | null
  slideIndex?: number
}

type TabType = 'style' | 'ai'

export function TextBoxFormatPanel({
  isOpen,
  isCollapsed,
  onCollapsedChange,
  onClose,
  elementId,
  formatting,
  onSendCommand,
  onDelete,
  presentationId,
  slideIndex = 0
}: TextBoxFormatPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('style')
  const [isApplying, setIsApplying] = useState(false)

  // Wrapper for sending commands with loading state
  const handleSendCommand = useCallback(async (action: string, params: Record<string, any>) => {
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
            <Type className="h-4 w-4 text-indigo-400" />
            <h2 className="text-[13px] font-medium text-white">Text</h2>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-md",
                "text-gray-500 hover:text-red-400 hover:bg-red-500/10",
                "transition-colors"
              )}
              title="Delete text box"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab Switcher - Keynote-style segmented control */}
        <div className="px-4 pt-3">
          <div className="flex h-8 bg-gray-800/50 rounded-lg p-[3px]">
            <button
              onClick={() => setActiveTab('style')}
              className={cn(
                "flex-1 flex items-center justify-center rounded-md",
                "text-[11px] font-medium transition-all duration-150",
                activeTab === 'style'
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              Style
            </button>
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
              AI
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'style' && (
            <StyleTab
              formatting={formatting}
              onSendCommand={handleSendCommand}
              isApplying={isApplying}
              elementId={elementId || ''}
            />
          )}
          {activeTab === 'ai' && (
            <AITab
              onSendCommand={handleSendCommand}
              isApplying={isApplying}
              elementId={elementId || ''}
              presentationId={presentationId}
              slideIndex={slideIndex}
            />
          )}
        </div>

        {/* Applying indicator - refined */}
        {isApplying && (
          <div className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2",
            "px-4 py-2 bg-indigo-600 rounded-full",
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
