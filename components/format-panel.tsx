"use client"

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Sparkles, Layout, Palette, MousePointer2, RefreshCw } from 'lucide-react'
import { SLIDE_LAYOUTS, SlideLayoutId } from './slide-layout-picker'
import { cn } from '@/lib/utils'

export interface SelectedSection {
  sectionId: string
  slideIndex: number
  content: string
}

interface FormatPanelProps {
  isOpen: boolean
  onClose: () => void
  currentSlide: number
  currentLayout?: SlideLayoutId
  onLayoutChange: (layout: SlideLayoutId) => Promise<void>
  // AI regeneration with Layout Service v7.5.3 APIs
  onGetSelectionInfo?: () => Promise<{ hasSelection: boolean; selectedText?: string; sectionId?: string; slideIndex?: number } | null>
  onUpdateSectionContent?: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
  onAIRegenerate?: (instruction: string, sectionId: string, currentContent: string) => Promise<string | null>
  isRegenerating?: boolean
}

/**
 * FormatPanel Component
 *
 * Slide-over panel that appears on the left side (over chat)
 * when user wants to format the current slide.
 *
 * Sections:
 * 1. Slide Layout - Change the layout of current slide
 * 2. AI Regenerate - Select sections and regenerate with AI (Phase 3)
 * 3. Appearance - Future: visibility toggles, colors
 */
export function FormatPanel({
  isOpen,
  onClose,
  currentSlide,
  currentLayout,
  onLayoutChange,
  onGetSelectionInfo,
  onUpdateSectionContent,
  onAIRegenerate,
  isRegenerating = false
}: FormatPanelProps) {
  const [isChangingLayout, setIsChangingLayout] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [selectedSection, setSelectedSection] = useState<SelectedSection | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const handleLayoutChange = async (value: string) => {
    setIsChangingLayout(true)
    try {
      await onLayoutChange(value as SlideLayoutId)
    } finally {
      setIsChangingLayout(false)
    }
  }

  // Capture the currently selected section from the slide
  const handleCaptureSelection = useCallback(async () => {
    if (!onGetSelectionInfo) return

    setIsCapturing(true)
    try {
      const info = await onGetSelectionInfo()
      if (info?.hasSelection && info.sectionId) {
        setSelectedSection({
          sectionId: info.sectionId,
          slideIndex: info.slideIndex ?? currentSlide - 1,
          content: info.selectedText || ''
        })
        console.log('📌 Captured section:', info.sectionId)
      } else {
        setSelectedSection(null)
      }
    } finally {
      setIsCapturing(false)
    }
  }, [onGetSelectionInfo, currentSlide])

  const handleAIRegenerate = async () => {
    if (!onAIRegenerate || !aiInstruction.trim() || !selectedSection) return

    const newContent = await onAIRegenerate(
      aiInstruction.trim(),
      selectedSection.sectionId,
      selectedSection.content
    )

    if (newContent && onUpdateSectionContent) {
      const success = await onUpdateSectionContent(
        selectedSection.slideIndex,
        selectedSection.sectionId,
        newContent
      )
      if (success) {
        setAiInstruction('')
        setSelectedSection(null)
        console.log('✅ Section content updated')
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/20 transition-opacity duration-200 z-10",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel - fills entire chat section */}
      <div
        className={cn(
          "absolute inset-0 bg-white shadow-xl z-20",
          "transform transition-transform duration-200 ease-out",
          "border-r border-gray-200",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Format</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-53px)]">
          {/* Current Slide Info */}
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <p className="text-sm text-blue-800">
              Editing <span className="font-semibold">Slide {currentSlide}</span>
            </p>
          </div>

          {/* Slide Layout Section */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Layout className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900">Slide Layout</h4>
            </div>
            <Select
              value={currentLayout}
              onValueChange={handleLayoutChange}
              disabled={isChangingLayout}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select layout" />
              </SelectTrigger>
              <SelectContent>
                {SLIDE_LAYOUTS.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    <div className="flex items-center gap-2">
                      {layout.icon}
                      <span>{layout.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-2">
              Change the layout of the current slide
            </p>
          </div>

          {/* AI Regenerate Section */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-medium text-gray-900">AI Regenerate</h4>
            </div>

            {onGetSelectionInfo && onUpdateSectionContent && onAIRegenerate ? (
              <div className="space-y-3">
                {/* Step 1: Capture Selection */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">
                    1. Select text in the slide, then capture:
                  </p>
                  <Button
                    onClick={handleCaptureSelection}
                    disabled={isCapturing || isRegenerating}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isCapturing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <MousePointer2 className="h-4 w-4 mr-2" />
                        Capture Selection
                      </>
                    )}
                  </Button>
                </div>

                {/* Selected Section Display */}
                {selectedSection && (
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-2">
                    <p className="text-xs font-medium text-purple-700 mb-1">
                      Selected: {selectedSection.sectionId}
                    </p>
                    <p className="text-xs text-purple-600 line-clamp-2">
                      {selectedSection.content || '(empty section)'}
                    </p>
                  </div>
                )}

                {/* Step 2: Enter Instructions */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">
                    2. Describe how to regenerate:
                  </p>
                  <textarea
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="e.g., Make this more concise, add bullet points, make it more professional..."
                    className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isRegenerating || !selectedSection}
                  />
                </div>

                {/* Regenerate Button */}
                <Button
                  onClick={handleAIRegenerate}
                  disabled={!aiInstruction.trim() || !selectedSection || isRegenerating}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {isRegenerating ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Regenerate with AI
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  AI regeneration coming soon
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Select sections and regenerate content with AI instructions
                </p>
              </div>
            )}
          </div>

          {/* Appearance Section - Placeholder */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900">Appearance</h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">
                Coming soon
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Background colors, element visibility, and more
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
