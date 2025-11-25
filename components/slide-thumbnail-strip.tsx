"use client"

import React from 'react'
import { cn } from '@/lib/utils'

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
 * - Compact design for side or bottom placement
 */
export function SlideThumbnailStrip({
  slides,
  currentSlide,
  onSlideClick,
  className = '',
  orientation = 'horizontal'
}: SlideThumbnailStripProps) {
  if (slides.length === 0) {
    return null
  }

  const isVertical = orientation === 'vertical'

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
        {slides.map((slide) => {
          const isActive = slide.slideNumber === currentSlide

          return (
            <button
              key={slide.slideNumber}
              onClick={() => onSlideClick(slide.slideNumber)}
              className={cn(
                isVertical
                  ? "flex-shrink-0 w-24 h-16 rounded-md border-2 transition-all duration-200"
                  : "flex-shrink-0 w-32 h-20 rounded-md border-2 transition-all duration-200",
                "flex flex-col items-center justify-center p-2",
                "hover:border-blue-400 hover:shadow-md",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isActive
                  ? "border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-500"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              )}
              title={slide.title || `Slide ${slide.slideNumber}`}
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
        })}
      </div>
    </div>
  )
}
