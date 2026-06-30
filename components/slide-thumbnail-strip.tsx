"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { Copy, Trash2, Layout, ChevronUp, ChevronDown, Check, Loader2, AlertTriangle, RotateCcw } from 'lucide-react'
import { SLIDE_LAYOUTS, SlideLayoutId } from './slide-layout-picker'
import { buildSlideComposeVisualOrder } from '@/lib/slide-compose-async'

export interface SlideThumbnail {
  slideNumber: number
  title?: string
  content?: string
}

export interface SlideComposeThumbnailJob {
  jobId: string
  targetIndex: number
  status: 'building' | 'error'
  title?: string
  errors?: string[]
  onRetry?: (jobId: string) => void
}

export interface SlideThumbnailStripProps {
  slides: SlideThumbnail[]
  currentSlide: number
  onSlideClick: (slideNumber: number) => void
  className?: string
  orientation?: 'horizontal' | 'vertical'
  // Multi-select support
  selectedSlides?: number[]  // Array of selected slide indices (0-based)
  onSelectionChange?: (selectedSlides: number[]) => void
  // CRUD handlers (optional - context menu only shows if handlers provided)
  onDuplicateSlide?: (slideIndex: number) => Promise<void>
  onDeleteSlide?: (slideIndex: number) => void // Opens confirmation dialog for single slide
  onDeleteSlides?: (slideIndices: number[]) => void // Opens confirmation dialog for multiple slides
  onChangeLayout?: (slideIndex: number, layout: SlideLayoutId) => Promise<void>
  onReorderSlides?: (fromIndex: number, toIndex: number) => Promise<void>
  enableDragDrop?: boolean
  totalSlides?: number
  composeJobs?: SlideComposeThumbnailJob[]
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
  selectedSlides = [],
  onSelectionChange,
  onDuplicateSlide,
  onDeleteSlide,
  onDeleteSlides,
  onChangeLayout,
  onReorderSlides,
  enableDragDrop = false,
  totalSlides,
  composeJobs = []
}: SlideThumbnailStripProps) {
  const [draggedSlide, setDraggedSlide] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState<number | null>(null)
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const slidesTotal = totalSlides ?? slides.length

  // Handle slide click with multi-select support (Ctrl/Cmd + Click, Shift + Click)
  const handleSlideSelect = useCallback((slideIndex: number, e: React.MouseEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey

    if (isCtrlOrCmd) {
      // Toggle individual selection
      e.preventDefault()
      const newSelection = selectedSlides.includes(slideIndex)
        ? selectedSlides.filter(i => i !== slideIndex)
        : [...selectedSlides, slideIndex]
      onSelectionChange?.(newSelection)
      setSelectionAnchor(slideIndex)
    } else if (isShift && selectionAnchor !== null) {
      // Range select from anchor to clicked
      e.preventDefault()
      const start = Math.min(selectionAnchor, slideIndex)
      const end = Math.max(selectionAnchor, slideIndex)
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      onSelectionChange?.(range)
    } else {
      // Normal click - single select and navigate
      onSelectionChange?.([slideIndex])
      setSelectionAnchor(slideIndex)
      onSlideClick(slideIndex + 1)  // Navigate (1-indexed)
    }
  }, [selectedSlides, selectionAnchor, onSelectionChange, onSlideClick])

  // Keyboard support: Delete/Backspace, Ctrl+A, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when the thumbnail strip has focus (container or any child)
      const container = containerRef.current
      if (!container) return

      // Check if container itself is focused OR contains the active element
      const hasFocus = container === document.activeElement ||
                       container.contains(document.activeElement)
      if (!hasFocus) return

      // Delete/Backspace - delete selected slides
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        // Prevent if only one slide or already processing
        if (slidesTotal <= 1 || isProcessing !== null) return

        e.preventDefault()

        if (selectedSlides.length > 0 && onDeleteSlides) {
          // Cannot delete all slides
          if (selectedSlides.length >= slidesTotal) return
          onDeleteSlides(selectedSlides)
        } else if (onDeleteSlide) {
          // Fallback: delete current slide
          onDeleteSlide(currentSlide - 1)
        }
      }

      // Ctrl/Cmd + A - select all slides
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const allSlides = Array.from({ length: slidesTotal }, (_, i) => i)
        onSelectionChange?.(allSlides)
      }

      // Escape - clear selection
      if (e.key === 'Escape') {
        e.preventDefault()
        onSelectionChange?.([])
        setSelectionAnchor(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlide, onDeleteSlide, onDeleteSlides, selectedSlides, slidesTotal, isProcessing, onSelectionChange])

  if (slides.length === 0 && composeJobs.length === 0) {
    return null
  }

  const isVertical = orientation === 'vertical'
  const hasCrudActions = onDuplicateSlide || onDeleteSlide || onChangeLayout || onReorderSlides

  const orderedItems = buildSlideComposeVisualOrder(slides, composeJobs)

  const renderComposeJob = (job: SlideComposeThumbnailJob, visualNumber: number) => {
    const isError = job.status === 'error'
    const title = job.title || (isError ? 'Slide failed' : 'Building slide')
    const errorText = job.errors?.filter(Boolean).join('; ')

    return (
      <div
        key={`compose-${job.jobId}`}
        className="relative group"
        title={isError ? (errorText || 'Slide Composer failed') : 'Slide Composer is building this slide'}
      >
        <button
          type="button"
          onClick={() => {
            if (isError) job.onRetry?.(job.jobId)
          }}
          className={cn(
            "relative flex-shrink-0 w-28 rounded-md border-2 transition-all duration-200 overflow-hidden",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
            isError
              ? "border-red-300 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100"
              : "border-purple-300 bg-purple-50 text-purple-700"
          )}
          disabled={!isError || !job.onRetry}
        >
          <div className={cn(
            "relative w-full aspect-[16/9] flex flex-col items-center justify-center gap-1.5 p-2",
            isError ? "bg-red-50" : "bg-purple-50"
          )}>
            <div className={cn(
              "absolute top-1.5 left-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded px-1 text-[9px] font-semibold leading-none",
              isError ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
            )}>
              {visualNumber}
            </div>
            {isError ? (
              <>
                <AlertTriangle className="h-5 w-5" />
                {job.onRetry && <RotateCcw className="h-3.5 w-3.5 opacity-70" />}
              </>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
          <div className={cn(
            "px-2 py-1.5 text-[10px] leading-tight text-left line-clamp-2 w-full",
            isError ? "bg-white text-red-700" : "bg-white text-purple-800"
          )}>
            {isError ? 'Retry compose' : title}
          </div>
        </button>
      </div>
    )
  }

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

  const renderThumbnail = (slide: SlideThumbnail, visualNumber: number) => {
    const realSlideNumber = slide.slideNumber
    const slideIndex = realSlideNumber - 1  // 0-based index
    const isActive = visualNumber === currentSlide
    const isSelected = selectedSlides.includes(slideIndex)
    const isDragging = draggedSlide === realSlideNumber
    const isDropTarget = dropTarget === realSlideNumber
    const isItemProcessing = isProcessing === realSlideNumber
    const canDelete = onDeleteSlide && slidesTotal > 1 && !isItemProcessing
    const displayTitle = !slide.title || /^Slide \d+$/i.test(slide.title)
      ? `Slide ${visualNumber}`
      : slide.title

    const thumbnailContent = (
      <div
        className="relative group"
        title="Click to navigate • Ctrl+Click to multi-select • Shift+Click for range • Right-click for options"
      >
        {/* Selection checkmark indicator */}
        {isSelected && (
          <div className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-blue-600 text-white
                         flex items-center justify-center shadow-sm">
            <Check className="h-3 w-3" />
          </div>
        )}

        {/* Delete button - appears on hover */}
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteSlide(realSlideNumber - 1)
            }}
            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-red-500 text-white
                       flex items-center justify-center opacity-0 group-hover:opacity-100
                       transition-opacity duration-150 hover:bg-red-600 shadow-sm"
            title="Delete slide"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}

        <button
          onClick={(e) => handleSlideSelect(slideIndex, e)}
          draggable={enableDragDrop && onReorderSlides && !isItemProcessing}
          onDragStart={(e) => handleDragStart(e, realSlideNumber)}
          onDragOver={(e) => handleDragOver(e, realSlideNumber)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, realSlideNumber)}
          onDragEnd={handleDragEnd}
          className={cn(
            "relative flex-shrink-0 w-28 rounded-md border-2 transition-all duration-200 overflow-hidden group",
            "hover:border-blue-400 hover:shadow-md",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            isActive
              ? "border-blue-600 shadow-lg ring-2 ring-blue-500"
              : isSelected
              ? "border-blue-400 shadow-md"
              : "border-slate-300 dark:border-slate-700",
            isDragging && "opacity-50 scale-95",
            isDropTarget && "border-green-500",
            isItemProcessing && "opacity-70 pointer-events-none",
            enableDragDrop && onReorderSlides && "cursor-grab active:cursor-grabbing"
          )}
          disabled={isItemProcessing}
        >
          {/* Mini-slide preview — 16:9 schematic showing a slide silhouette.
              Not a real render (that needs Layout Service support); this is
              the strongest interim visual cue that beats text-only thumbs. */}
          <div className={cn(
            "relative w-full aspect-[16/9] flex flex-col justify-end p-2 gap-1",
            isActive
              ? "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800"
              : isSelected
              ? "bg-blue-50 dark:bg-slate-800"
              : "bg-slate-100 dark:bg-slate-800"
          )}>
            {/* Schematic title bar */}
            <div className={cn(
              "h-1 w-3/4 rounded-sm",
              isActive ? "bg-blue-400 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
            )} />
            {/* Schematic body lines */}
            <div className={cn(
              "h-0.5 w-2/3 rounded-sm",
              isActive ? "bg-blue-300/70 dark:bg-blue-600/60" : "bg-slate-300/70 dark:bg-slate-600/60"
            )} />
            <div className={cn(
              "h-0.5 w-1/2 rounded-sm",
              isActive ? "bg-blue-300/70 dark:bg-blue-600/60" : "bg-slate-300/70 dark:bg-slate-600/60"
            )} />

            {/* Slide number badge in corner */}
            <div className={cn(
              "absolute top-1.5 left-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded px-1 text-[9px] font-semibold leading-none",
              isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            )}>
              {visualNumber}
            </div>
          </div>

          {/* Title strip below the mini-preview */}
          <div className={cn(
            "px-2 py-1.5 text-[10px] leading-tight text-left line-clamp-2 w-full",
            isActive
              ? "text-blue-900 font-medium bg-blue-50 dark:bg-slate-900 dark:text-blue-200"
              : isSelected
              ? "text-blue-800 bg-blue-50 dark:bg-slate-900 dark:text-blue-300"
              : "text-slate-700 bg-white dark:bg-slate-900 dark:text-slate-300"
          )}>
            {displayTitle}
          </div>
        </button>
      </div>
    )

    // Wrap with context menu if CRUD actions are available
    if (hasCrudActions) {
      return (
        <ContextMenu key={realSlideNumber}>
          <ContextMenuTrigger asChild>
            {thumbnailContent}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {/* Duplicate */}
            {onDuplicateSlide && (
              <ContextMenuItem
                onSelect={() => handleDuplicate(realSlideNumber)}
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
                      onSelect={() => handleChangeLayout(realSlideNumber, layout.id)}
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
                  onSelect={() => handleMoveUp(realSlideNumber)}
                  disabled={isItemProcessing || realSlideNumber <= 1}
                >
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Move Up
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => handleMoveDown(realSlideNumber)}
                  disabled={isItemProcessing || realSlideNumber >= slidesTotal}
                >
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Move Down
                </ContextMenuItem>
              </>
            )}

            {/* Delete - Always last, with separator */}
            {/* If multiple slides selected, delete all; otherwise delete just this slide */}
            {(onDeleteSlide || onDeleteSlides) && (
              <>
                <ContextMenuSeparator />
                {selectedSlides.length > 1 && onDeleteSlides ? (
                  <ContextMenuItem
                    onSelect={() => onDeleteSlides(selectedSlides)}
                    disabled={isItemProcessing || selectedSlides.length >= slidesTotal}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {selectedSlides.length} Slides
                  </ContextMenuItem>
                ) : onDeleteSlide && (
                  <ContextMenuItem
                    onSelect={() => onDeleteSlide(realSlideNumber - 1)}
                    disabled={isItemProcessing || slidesTotal <= 1}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Slide
                  </ContextMenuItem>
                )}
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )
    }

    return <React.Fragment key={realSlideNumber}>{thumbnailContent}</React.Fragment>
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        isVertical
          ? "h-full bg-gray-50 dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 py-4 px-2"
          : "w-full bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 py-3 px-4",
        "focus:outline-none",
        className
      )}
    >
      <div className={cn(
        isVertical
          ? "flex flex-col items-center gap-2 overflow-y-auto h-full pt-2 pb-12 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
          : "flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
      )}>
        {orderedItems.map(item =>
          item.kind === 'compose'
            ? renderComposeJob(item.job, item.visualNumber)
            : renderThumbnail(item.slide, item.visualNumber)
        )}
      </div>
    </div>
  )
}
