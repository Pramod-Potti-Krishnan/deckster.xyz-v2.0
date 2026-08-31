"use client"

/**
 * SlideMentionPopover (MDC §6.3): shown while the user is typing an `@`
 * mention in the chat input. Lists the deck's slides (number + title);
 * selecting one hands back the serialized token. Pure presentational —
 * open/close and insertion live in ChatInput.
 */

import React from "react"
import { Layers } from "lucide-react"
import { filterMentionSlides, type MentionSlide } from "@/lib/mdc-mentions"

export interface SlideMentionPopoverProps {
  slides: MentionSlide[]
  /** Text typed after the trailing '@' — filters the list. */
  query: string
  onSelect: (slide: MentionSlide) => void
}

export function SlideMentionPopover({ slides, query, onSelect }: SlideMentionPopoverProps) {
  const filtered = filterMentionSlides(slides, query)
  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50">
      <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        Tag a slide
      </p>
      {filtered.slice(0, 12).map((slide) => (
        <button
          key={slide.index}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault() // keep textarea focus
            onSelect(slide)
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          <Layers className="h-3 w-3 text-purple-500 shrink-0" />
          <span className="font-medium shrink-0">Slide {slide.index + 1}</span>
          <span className="truncate text-gray-500 dark:text-slate-400">{slide.title}</span>
        </button>
      ))}
    </div>
  )
}
