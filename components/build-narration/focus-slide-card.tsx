"use client"

import React from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, Pin, PinOff } from 'lucide-react'
import type { GhostSlide, NarrationEvent, SlideBuildState } from '@/lib/build-narration-heuristics'
import { StageDots } from './stage-dots'
import { SKELETON_CROSSFADE_S, SHIMMER_SWEEP_S, SHIMMER_REPEAT_DELAY_S, CHECK_POP_SPRING } from './motion'

export interface FocusSlideCardProps {
  ghost: GhostSlide | null
  state: SlideBuildState
  events: NarrationEvent[]
  thumbnail?: string
  typedSource: boolean
  isPinned: boolean
  onTogglePin: () => void
  className?: string
}

/**
 * The large "now building" card: ghost strawman content + stage progress +
 * that slide's rolling chain-of-thought lines; settles (or flips to the real
 * thumbnail) when the slide is built.
 */
export function FocusSlideCard({
  ghost,
  state,
  events,
  thumbnail,
  typedSource,
  isPinned,
  onTogglePin,
  className,
}: FocusSlideCardProps) {
  const reduced = useReducedMotion()
  if (!ghost) return null
  const built = state === 'built'
  const lastLines = events.slice(-3)

  return (
    <div className={className} data-testid="bn-focus-card">
      <div
        className={[
          'relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-xl border bg-card p-5 shadow-lg',
          built ? 'border-primary/50' : 'border-border',
        ].join(' ')}
      >
        {thumbnail ? (
          <motion.img
            src={thumbnail}
            alt={`Slide ${ghost.index + 1} preview`}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: SKELETON_CROSSFADE_S }}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Slide {ghost.index + 1}
                  {ghost.slideType ? (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {String(ghost.slideType).replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </div>
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: SKELETON_CROSSFADE_S }}
                  className="mt-0.5 text-lg font-semibold leading-snug text-foreground"
                >
                  {ghost.title}
                </motion.h3>
              </div>
              <button
                type="button"
                onClick={onTogglePin}
                className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isPinned ? 'Unpin slide' : 'Pin slide'}
              >
                {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            </div>

            <ul className="mt-3 space-y-1.5">
              {ghost.points.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: SKELETON_CROSSFADE_S, delay: reduced ? 0 : 0.1 * i }}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  {p}
                </motion.li>
              ))}
              {ghost.points.length === 0 && (
                <div className="space-y-1.5" aria-hidden>
                  <div className="h-2 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
              )}
            </ul>

            {/* Provisional shimmer until settled */}
            {!built && !reduced && (
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: SHIMMER_SWEEP_S, repeatDelay: SHIMMER_REPEAT_DELAY_S, ease: 'linear' }}
                aria-hidden
              />
            )}
          </>
        )}

        {built && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={CHECK_POP_SPRING}
            className="absolute bottom-3 right-3 rounded-full bg-primary p-1 text-primary-foreground"
            aria-label="Slide built"
          >
            <Check className="h-3.5 w-3.5" />
          </motion.div>
        )}
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-xl items-center justify-between">
        <StageDots events={events} built={built} typedSource={typedSource} />
      </div>

      <div className="mx-auto mt-2 w-full max-w-xl space-y-1" aria-live="polite">
        <AnimatePresence initial={false}>
          {lastLines.map((ev) => (
            <motion.div
              key={ev.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground"
            >
              {ev.text}
              {ev.detail ? <span className="block pl-3 opacity-80">{ev.detail}</span> : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
