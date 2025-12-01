"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Sparkles, Layout, Palette } from 'lucide-react'
import { SLIDE_LAYOUTS, SlideLayoutId } from './slide-layout-picker'
import { cn } from '@/lib/utils'

interface FormatPanelProps {
  isOpen: boolean
  onClose: () => void
  currentSlide: number
  currentLayout?: SlideLayoutId
  onLayoutChange: (layout: SlideLayoutId) => Promise<void>
  // Future: AI regeneration props
  onAIRegenerate?: (instruction: string) => Promise<void>
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
  onAIRegenerate,
  isRegenerating = false
}: FormatPanelProps) {
  const [isChangingLayout, setIsChangingLayout] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')

  const handleLayoutChange = async (value: string) => {
    setIsChangingLayout(true)
    try {
      await onLayoutChange(value as SlideLayoutId)
    } finally {
      setIsChangingLayout(false)
    }
  }

  const handleAIRegenerate = async () => {
    if (!onAIRegenerate || !aiInstruction.trim()) return
    await onAIRegenerate(aiInstruction.trim())
    setAiInstruction('')
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

      {/* Panel */}
      <div
        className={cn(
          "absolute top-0 left-0 h-full w-80 bg-white shadow-xl z-20",
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

            {onAIRegenerate ? (
              <>
                <textarea
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Describe how you want to change this slide..."
                  className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isRegenerating}
                />
                <Button
                  onClick={handleAIRegenerate}
                  disabled={!aiInstruction.trim() || isRegenerating}
                  className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
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
              </>
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
