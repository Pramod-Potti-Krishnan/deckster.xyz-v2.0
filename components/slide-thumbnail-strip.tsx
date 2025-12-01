"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Copy, Trash2, Layout, ChevronUp, ChevronDown } from 'lucide-react'
import { SLIDE_LAYOUTS, SlideLayoutId } from './slide-layout-picker'

export interface SlideThumbnail {
  slideNumber: number
  title?: string
  content?: string
}

export interface SlideThumbnailStripProps {
  slides: SlideThumbnail[]
  currentSlide: number
  onSlideClick: (slideNumber: number) => void
  className?: string
  orientation?: 'horizontal' | 'vertical'
  // CRUD handlers (optional - context menu only shows if handlers provided)
  onDuplicateSlide?: (slideIndex: number) => Promise<void>
  onDeleteSlide?: (slideIndex: number) => void // Opens confirmation dialog
  onChangeLayout?: (slideIndex: number, layout: SlideLayoutId) => Promise<void>
  onReorderSlides?: (fromIndex: number, toIndex: number) => Promise<void>
  enableDragDrop?: boolean
  totalSlides?: number
}

/**
 * SlideThumbnailStrip Component
 *
 * Displays a scrollable strip of slide thumbnails for quick navigation.
 * Shows slide numbers and titles.
 *
 * Features:
 * - Horizontal or vertical scrollable layout
 * - Highlights current slide
 * - Click to navigate to any slide
 * - Context menu for CRUD operations (duplicate, delete, change layout)
 * - Drag-drop reordering (when enabled)
 */
export function SlideThumbnailStrip({
  slides,
  currentSlide,
  onSlideClick,
  className = '',
  orientation = 'horizontal',
  onDuplicateSlide,
  onDeleteSlide,
  onChangeLayout,
  onReorderSlides,
  enableDragDrop = false,
  totalSlides
}: SlideThumbnailStripProps) {
  const [draggedSlide, setDraggedSlide] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState<number | null>(null)

  if (slides.length === 0) {
    return null
  }

  const isVertical = orientation === 'vertical'
  const hasCrudActions = onDuplicateSlide || onDeleteSlide || onChangeLayout || onReorderSlides
  const slidesTotal = totalSlides ?? slides.length

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, slideNumber: number) => {
    if (!enableDragDrop || !onReorderSlides) return
    setDraggedSlide(slideNumber)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(slideNumber))
  }

  const handleDragOver = (e: React.DragEvent, slideNumber: number) => {
    if (!enableDragDrop || !onReorderSlides || draggedSlide === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (slideNumber !== draggedSlide) {
      setDropTarget(slideNumber)
    }
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = async (e: React.DragEvent, targetSlideNumber: number) => {
    e.preventDefault()
    if (!onReorderSlides || draggedSlide === null || draggedSlide === targetSlideNumber) {
      setDraggedSlide(null)
      setDropTarget(null)
      return
    }

    setIsProcessing(draggedSlide)
    try {
      await onReorderSlides(draggedSlide - 1, targetSlideNumber - 1) // Convert to 0-based
    } finally {
      setDraggedSlide(null)
      setDropTarget(null)
      setIsProcessing(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedSlide(null)
    setDropTarget(null)
  }

  // CRUD handlers with processing state
  const handleDuplicate = async (slideNumber: number) => {
    if (!onDuplicateSlide) return
    setIsProcessing(slideNumber)
    try {
      await onDuplicateSlide(slideNumber - 1) // Convert to 0-based
    } finally {
      setIsProcessing(null)
    }
  }

  const handleChangeLayout = async (slideNumber: number, layout: SlideLayoutId) => {
    if (!onChangeLayout) return
    setIsProcessing(slideNumber)
    try {
      await onChangeLayout(slideNumber - 1, layout) // Convert to 0-based
    } finally {
      setIsProcessing(null)
    }
  }

  const handleMoveUp = async (slideNumber: number) => {
    if (!onReorderSlides || slideNumber <= 1) return
    setIsProcessing(slideNumber)
    try {
      await onReorderSlides(slideNumber - 1, slideNumber - 2) // Move up = swap with previous
    } finally {
      setIsProcessing(null)
    }
  }

  const handleMoveDown = async (slideNumber: number) => {
    if (!onReorderSlides || slideNumber >= slidesTotal) return
    setIsProcessing(slideNumber)
    try {
      await onReorderSlides(slideNumber - 1, slideNumber) // Move down = swap with next
    } finally {
      setIsProcessing(null)
    }
  }

  const renderThumbnail = (slide: SlideThumbnail) => {
    const isActive = slide.slideNumber === currentSlide
    const isDragging = draggedSlide === slide.slideNumber
    const isDropTarget = dropTarget === slide.slideNumber
    const isItemProcessing = isProcessing === slide.slideNumber

    const thumbnailContent = (
      <button
        onClick={() => onSlideClick(slide.slideNumber)}
        draggable={enableDragDrop && onReorderSlides && !isItemProcessing}
        onDragStart={(e) => handleDragStart(e, slide.slideNumber)}
        onDragOver={(e) => handleDragOver(e, slide.slideNumber)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, slide.slideNumber)}
        onDragEnd={handleDragEnd}
        className={cn(
          isVertical
            ? "flex-shrink-0 w-24 h-16 rounded-md border-2 transition-all duration-200"
            : "flex-shrink-0 w-32 h-20 rounded-md border-2 transition-all duration-200",
          "flex flex-col items-center justify-center p-2",
          "hover:border-blue-400 hover:shadow-md",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isActive
            ? "border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-500"
            : "border-gray-300 bg-white hover:bg-gray-50",
          isDragging && "opacity-50 scale-95",
          isDropTarget && "border-green-500 bg-green-50",
          isItemProcessing && "opacity-70 pointer-events-none",
          enableDragDrop && onReorderSlides && "cursor-grab active:cursor-grabbing"
        )}
        title={slide.title || `Slide ${slide.slideNumber}`}
        disabled={isItemProcessing}
      >
        {/* Slide Number */}
        <div className={cn(
          "text-xs font-semibold mb-1",
          isActive ? "text-blue-700" : "text-gray-500"
        )}>
          {slide.slideNumber}
        </div>

        {/* Slide Title/Preview */}
        <div className={cn(
          "text-[10px] leading-tight text-center line-clamp-2 w-full",
          isActive ? "text-blue-900 font-medium" : "text-gray-600"
        )}>
          {slide.title || 'Untitled Slide'}
        </div>
      </button>
    )

    // Wrap with context menu if CRUD actions are available
    if (hasCrudActions) {
      return (
        <ContextMenu key={slide.slideNumber}>
          <ContextMenuTrigger asChild>
            {thumbnailContent}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {/* Duplicate */}
            {onDuplicateSlide && (
              <ContextMenuItem
                onClick={() => handleDuplicate(slide.slideNumber)}
                disabled={isItemProcessing}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Slide
              </ContextMenuItem>
            )}

            {/* Change Layout Submenu */}
            {onChangeLayout && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Layout className="mr-2 h-4 w-4" />
                  Change Layout
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48">
                  {SLIDE_LAYOUTS.map((layout) => (
                    <ContextMenuItem
                      key={layout.id}
                      onClick={() => handleChangeLayout(slide.slideNumber, layout.id)}
                      disabled={isItemProcessing}
                    >
                      {layout.icon}
                      <span className="ml-2">{layout.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            {/* Move Up/Down */}
            {onReorderSlides && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => handleMoveUp(slide.slideNumber)}
                  disabled={isItemProcessing || slide.slideNumber <= 1}
                >
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Move Up
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => handleMoveDown(slide.slideNumber)}
                  disabled={isItemProcessing || slide.slideNumber >= slidesTotal}
                >
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Move Down
                </ContextMenuItem>
              </>
            )}

            {/* Delete - Always last, with separator */}
            {onDeleteSlide && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => onDeleteSlide(slide.slideNumber - 1)} // 0-based
                  disabled={isItemProcessing || slidesTotal <= 1}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Slide
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )
    }

    return <React.Fragment key={slide.slideNumber}>{thumbnailContent}</React.Fragment>
  }

  return (
    <div className={cn(
      isVertical
        ? "h-full bg-gray-50 border-l border-gray-200 py-4 px-2"
        : "w-full bg-gray-50 border-t border-gray-200 py-3 px-4",
      className
    )}>
      <div className={cn(
        isVertical
          ? "flex flex-col items-center gap-2 overflow-y-auto h-full scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
          : "flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
      )}>
        {slides.map(renderThumbnail)}
      </div>
    </div>
  )
}
