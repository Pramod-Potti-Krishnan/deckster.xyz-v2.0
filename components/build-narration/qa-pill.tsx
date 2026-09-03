"use client"

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import type { NarrationState } from '@/lib/build-narration-heuristics'

/**
 * Canvas v2 R3 — Stage-F quality checks as a small pill OVER the visible deck
 * (never hiding it). pointer-events-none; the deck stays on stage.
 */
export function QAPill({ narration: n, className }: { narration: NarrationState; className?: string }) {
  const reduced = useReducedMotion()
  const qaEvents = n.deckEvents.filter((e) => e.stage === 'qa')
  const latest = qaEvents.length ? qaEvents[qaEvents.length - 1] : null
  const verdicts = Object.values(n.qaVerdicts)
  const green = verdicts.filter((v) => v === 'green').length
  const amber = verdicts.filter((v) => v === 'amber').length
  const skippedCount = Object.keys(n.qaSkipped).length
  const skippedTitle = skippedCount
    ? `QA skipped on ${skippedCount} slide${skippedCount > 1 ? 's' : ''}: ` +
      Object.entries(n.qaSkipped)
        .map(([i, r]) => `slide ${Number(i) + 1} — ${r}`)
        .join('; ')
    : undefined

  return (
    <div
      className={[
        'pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2',
        className || '',
      ].join(' ')}
      data-testid="bn-qa-pill"
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-md backdrop-blur-sm"
        aria-live="polite"
        title={skippedTitle}
      >
        <ShieldCheck className="h-3.5 w-3.5 flex-none text-primary" aria-hidden />
        <span className="max-w-[46ch] truncate text-xs text-foreground">
          {latest?.text || 'Running quality checks…'}
        </span>
        {verdicts.length > 0 && (
          <span className="flex-none text-[11px] tabular-nums text-muted-foreground">
            {green} green{amber > 0 ? ` · ${amber} amber` : ''}
          </span>
        )}
      </motion.div>
    </div>
  )
}
