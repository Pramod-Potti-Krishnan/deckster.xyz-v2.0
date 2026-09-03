"use client"

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { NarrationPhase } from '@/lib/build-narration-heuristics'
import { DECK_SETTLE_S, PERIMETER_ORBIT_S } from './motion'

export interface SlideFrameGlowProps {
  phase: NarrationPhase
  className?: string
}

const SHIELD_PHASES: NarrationPhase[] = ['building', 'qa', 'finalizing']
const ORBIT_PHASES: NarrationPhase[] = ['planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing']

/**
 * Canvas v2 R2 — the perimeter animation PK asked for: a comet of light
 * orbiting the slide frame while the machine works, plus (during write
 * phases) a transparent click-shield so the deck is view-only mid-write.
 * Always pointer-events-none except the shield. Reduced motion: static glow.
 */
export function SlideFrameGlow({ phase, className }: SlideFrameGlowProps) {
  const reduced = useReducedMotion()
  const orbiting = ORBIT_PHASES.includes(phase)
  const halted = phase === 'paused' || phase === 'stopped'
  const errored = phase === 'error'
  const complete = phase === 'complete'
  const shield = SHIELD_PHASES.includes(phase)

  const stroke = errored
    ? 'hsl(var(--destructive))'
    : 'hsl(var(--primary))'

  return (
    <div
      className={['pointer-events-none absolute -inset-[3px] z-20', className || ''].join(' ')}
      data-testid="bn-frame-glow"
      aria-hidden
    >
      <svg className="h-full w-full overflow-visible" preserveAspectRatio="none">
        {/* faint static full-perimeter ring — always on while narration runs */}
        <rect
          x="1.5"
          y="1.5"
          rx="8"
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          opacity={errored ? 0.4 : halted ? 0.22 : complete ? 0 : 0.28}
          style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}
        />
        {/* the orbiting comet */}
        {orbiting && !reduced && !halted && (
          <motion.rect
            x="1.5"
            y="1.5"
            rx="8"
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="14 86"
            style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)', filter: `drop-shadow(0 0 6px ${stroke})` }}
            animate={{ strokeDashoffset: [0, -100] }}
            transition={{ duration: PERIMETER_ORBIT_S, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {/* reduced-motion replacement: steady soft glow ring */}
        {orbiting && reduced && !halted && (
          <rect
            x="1.5"
            y="1.5"
            rx="8"
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            opacity={0.55}
            style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)', filter: `drop-shadow(0 0 5px ${stroke})` }}
          />
        )}
        {/* one-shot completion flash */}
        {complete && !reduced && (
          <motion.rect
            x="1.5"
            y="1.5"
            rx="8"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: DECK_SETTLE_S, ease: 'easeOut' }}
            style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)', filter: `drop-shadow(0 0 8px ${stroke})` }}
          />
        )}
      </svg>
      {/* view-only shield while the machine writes the deck */}
      {shield && (
        <div
          className="pointer-events-auto absolute inset-[3px] z-20"
          data-testid="bn-click-shield"
        />
      )}
    </div>
  )
}
