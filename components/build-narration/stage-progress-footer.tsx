"use client"

import React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { NarrationState } from '@/lib/build-narration-heuristics'
import { StageIcon } from './stage-icons'
import { StageDots } from './stage-dots'
import { COT_LINE_ENTER_S } from './motion'

export interface StageProgressFooterProps {
  narration: NarrationState
  /** Canvas v2 R3: the research strip for the slide currently on stage. */
  researchCard?: React.ReactNode
  className?: string
}

const VISIBLE_LINES = 3

/**
 * Canvas v2 R2 — the compact progress region BELOW the slide: the latest CoT
 * lines (each with its stage icon), the focus slide's Plan→Validate→Render
 * dots while it builds, and (R3) the research card for the center slide.
 * Phase-driven, no branch ladder — finalizing and error render here too.
 */
export function StageProgressFooter({ narration: n, researchCard, className }: StageProgressFooterProps) {
  const reduced = useReducedMotion()
  const lines = n.deckEvents.slice(-VISIBLE_LINES)
  const focus = n.focusSlide
  const focusEvents = focus !== null ? n.slideEvents[focus] || [] : []
  const latestSlideLine = focusEvents.length ? focusEvents[focusEvents.length - 1] : null
  const focusBuilt = focus !== null && n.slideStates[focus] === 'built'

  return (
    <div
      className={['px-4 pb-1.5 pt-1', className || ''].join(' ')}
      data-testid="bn-progress-footer"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
        {/* focus-slide row: dots + its latest beat */}
        {focus !== null && focusEvents.length > 0 && (
          <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="flex-none font-medium text-foreground/80">Slide {focus + 1}</span>
            <StageDots
              events={focusEvents}
              built={focusBuilt}
              typedSource={n.source === 'typed'}
            />
            {latestSlideLine && (
              <span className="truncate">{latestSlideLine.text}</span>
            )}
          </div>
        )}
        {/* deck CoT lines, newest emphasized, each with its stage icon */}
        <ul className="flex flex-col gap-0.5" aria-live="polite">
          <AnimatePresence initial={false}>
            {lines.map((ev, i) => {
              const isLatest = i === lines.length - 1
              return (
                <motion.li
                  key={ev.id}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: COT_LINE_ENTER_S }}
                  className={[
                    'flex min-w-0 items-baseline gap-2',
                    isLatest ? 'text-xs text-foreground' : 'text-[11px] text-muted-foreground/70',
                    ev.status === 'error' ? 'text-destructive' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'relative top-0.5 flex-none',
                      ev.status === 'error'
                        ? 'text-destructive'
                        : isLatest
                          ? 'text-primary'
                          : 'text-muted-foreground/60',
                    ].join(' ')}
                  >
                    <StageIcon stage={ev.stage} className="h-3 w-3" />
                  </span>
                  <span className="truncate">{ev.text}</span>
                  {isLatest && ev.detail ? (
                    <span className="truncate text-[11px] text-muted-foreground/70">— {ev.detail}</span>
                  ) : null}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
        {researchCard}
      </div>
    </div>
  )
}
