"use client"

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, AlertTriangle, MinusCircle } from 'lucide-react'
import type { GhostSlide, SlideBuildState } from '@/lib/build-narration-heuristics'
import {
  GHOST_STAGGER_S,
  GHOST_SPRING,
  BUILDING_RING_S,
  SHIMMER_SWEEP_S,
  SHIMMER_REPEAT_DELAY_S,
  CHECK_POP_SPRING,
} from './motion'

const MAX_TILES = 12

export interface GhostDeckRailProps {
  ghosts: GhostSlide[]
  slideStates: Record<number, SlideBuildState>
  thumbnails: Record<number, string>
  qaVerdicts: Record<number, string>
  focusSlide: number | null
  pinnedSlide: number | null
  onPin: (slideIndex: number | null) => void
  className?: string
}

/**
 * The strawman-as-placeholder deck: one 16:9 mini-card per slide, cascading in
 * with clearly-provisional styling; ring states narrate per-slide progress
 * (pending = dashed, building = rotating conic ring, built = check pop,
 * error = badge, qa = pulse).
 */
export function GhostDeckRail({
  ghosts,
  slideStates,
  thumbnails,
  qaVerdicts,
  focusSlide,
  pinnedSlide,
  onPin,
  className,
}: GhostDeckRailProps) {
  const reduced = useReducedMotion()
  const shown = ghosts.slice(0, MAX_TILES)
  const overflow = ghosts.length - shown.length

  return (
    <div className={className} data-testid="bn-ghost-rail">
      <div className="flex flex-wrap gap-2.5 justify-center">
        {shown.map((g, i) => (
          <motion.button
            key={g.index}
            type="button"
            onClick={() => onPin(pinnedSlide === g.index ? null : g.index)}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduced ? { duration: 0.2 } : { ...GHOST_SPRING, delay: i * GHOST_STAGGER_S }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            aria-label={`Slide ${g.index + 1}: ${g.title}`}
          >
            <GhostTile
              ghost={g}
              state={slideStates[g.index] || 'pending'}
              thumbnail={thumbnails[g.index]}
              qaVerdict={qaVerdicts[g.index]}
              isFocus={focusSlide === g.index}
              isPinned={pinnedSlide === g.index}
              reduced={!!reduced}
            />
          </motion.button>
        ))}
        {overflow > 0 && (
          <div className="flex h-[72px] w-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  )
}

function GhostTile({
  ghost,
  state,
  thumbnail,
  qaVerdict,
  isFocus,
  isPinned,
  reduced,
}: {
  ghost: GhostSlide
  state: SlideBuildState
  thumbnail?: string
  qaVerdict?: string
  isFocus: boolean
  isPinned: boolean
  reduced: boolean
}) {
  return (
    <div className="relative h-[72px] w-32">
      {/* Building ring: rotating conic sweep (PK's "rotating animation on the thumbnail") */}
      {state === 'building' && !reduced && (
        <motion.div
          className="absolute -inset-[2px] rounded-lg"
          style={{
            background:
              'conic-gradient(from 0deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.15) 30%, transparent 60%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: BUILDING_RING_S, ease: 'linear' }}
          aria-hidden
        />
      )}
      {state === 'building' && reduced && (
        <div className="absolute -inset-[2px] rounded-lg bg-primary/40" aria-hidden />
      )}
      {state === 'qa' && (
        <motion.div
          className="absolute -inset-[2px] rounded-lg bg-primary/25"
          animate={reduced ? undefined : { opacity: [0.25, 0.6, 0.25] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          aria-hidden
        />
      )}

      <div
        className={[
          'relative flex h-full w-full flex-col overflow-hidden rounded-lg bg-card p-1.5 text-left',
          state === 'pending' ? 'border border-dashed border-border' : 'border border-border',
          state === 'built' ? 'ring-2 ring-primary' : '',
          state === 'error' ? 'ring-2 ring-destructive' : '',
          isFocus || isPinned ? 'shadow-md' : 'shadow-sm',
        ].join(' ')}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">{ghost.index + 1}</span>
              <span className="truncate text-[10px] font-medium text-foreground">{ghost.title}</span>
            </div>
            <div className="mt-1 space-y-1" aria-hidden>
              <div className="h-1 w-4/5 rounded bg-muted" />
              <div className="h-1 w-3/5 rounded bg-muted" />
            </div>
            {/* Provisional shimmer while not settled */}
            {(state === 'pending' || state === 'building') && !reduced && (
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{
                  repeat: Infinity,
                  duration: SHIMMER_SWEEP_S,
                  repeatDelay: SHIMMER_REPEAT_DELAY_S,
                  ease: 'linear',
                }}
                aria-hidden
              />
            )}
          </>
        )}

        {/* State badges */}
        {state === 'built' && (
          <motion.span
            initial={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={CHECK_POP_SPRING}
            className="absolute bottom-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground"
            aria-label="Built"
          >
            <Check className="h-2.5 w-2.5" />
          </motion.span>
        )}
        {state === 'error' && (
          <span className="absolute bottom-1 right-1 text-destructive" aria-label="Error">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
        {state === 'skipped' && (
          <span className="absolute bottom-1 right-1 text-muted-foreground" aria-label="Skipped">
            <MinusCircle className="h-3 w-3" />
          </span>
        )}
        {qaVerdict && state === 'built' && (
          <span
            className={[
              'absolute bottom-1 left-1 h-2 w-2 rounded-full',
              qaVerdict === 'green' ? 'bg-primary' : qaVerdict === 'amber' ? 'bg-muted-foreground' : 'bg-destructive',
            ].join(' ')}
            aria-label={`QA ${qaVerdict}`}
          />
        )}
      </div>
    </div>
  )
}
