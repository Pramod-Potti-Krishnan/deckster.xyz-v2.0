"use client"

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import type { NarrationEvent } from '@/lib/build-narration-heuristics'
import { QA_SHEEN_S } from './motion'

/**
 * P4 — the light quality-check overlay (Stage F): a translucent sheen sweeps
 * the canvas while a small chip cycles the qa chain-of-thought. Mounts only
 * when the build actually enters the qa phase (no Stage F ⇒ never shown).
 */
export function QASweep({ events, className }: { events: NarrationEvent[]; className?: string }) {
  const reduced = useReducedMotion()
  const qaLines = events.filter((e) => e.stage === 'qa')
  const latest = qaLines[qaLines.length - 1]

  return (
    <div className={className} data-testid="bn-qa-sweep">
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: QA_SHEEN_S, ease: 'easeInOut' }}
        />
      )}
      <div className="relative flex items-center justify-center pt-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-foreground" aria-live="polite">
            {latest ? latest.text : 'Running quality checks…'}
          </span>
        </div>
      </div>
    </div>
  )
}
