"use client"

import { useState, useCallback } from 'react'
import { X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { StyleTab } from './style-tab'
import { LayoutTab } from './layout-tab'
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

type TabType = 'style' | 'layout' | 'ai'

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
      {/* Panel Container - Absolute positioned within chat container */}
      <div
        className={cn(
          "absolute inset-0 bg-gray-900 text-white shadow-2xl z-20 flex flex-col",
          "transform transition-transform duration-200 ease-out",
          isCollapsed ? "-translate-x-[calc(100%-32px)]" : "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold">Text Box</h2>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
                title="Delete text box"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onCollapsedChange(true)}
              className="p-1.5 rounded hover:bg-gray-700 transition-colors"
              title="Collapse panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Headers - Keynote-style segmented control */}
        <div className="flex mx-4 mt-3 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('style')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'style'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Style
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'layout'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Layout
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'ai'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            AI
          </button>
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
          {activeTab === 'layout' && (
            <LayoutTab
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

        {/* Applying indicator */}
        {isApplying && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-600 rounded-full text-xs">
            Applying...
          </div>
        )}

        {/* Expand Arrow - shown on right edge when collapsed */}
        <button
          onClick={() => onCollapsedChange(!isCollapsed)}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 w-8 h-16",
            "bg-gray-800 hover:bg-gray-700 rounded-r-lg",
            "flex items-center justify-center transition-colors",
            "border-l border-gray-700"
          )}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          )}
        </button>
      </div>
    </>
  )
}
