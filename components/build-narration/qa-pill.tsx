"use client"

import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import type { NarrationState } from '@/lib/build-narration-heuristics'
import '@/components/build-narration/studio-stage-leafs.css'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * Canvas v2 R3 — Stage-F quality checks as a small pill OVER the visible deck
 * (never hiding it). pointer-events-none; the deck stays on stage.
 */
export function QAPill({ narration: n, className }: { narration: NarrationState; className?: string }) {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const [inspectOpen, setInspectOpen] = useState(false)
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

  if (studioShell) {
    return (
      <div data-studio-qa="true" className={[
        'pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2',
        className || '',
      ].join(' ')} data-testid="bn-qa-pill">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-md backdrop-blur-sm"
          aria-live="polite" title={skippedTitle} data-studio-qa-body="true"
        >
          <ShieldCheck className="h-3.5 w-3.5 flex-none text-primary" aria-hidden />
          <span data-studio-qa-message="true" aria-description={latest?.text || 'Running quality checks…'}>{latest?.text || 'Running quality checks…'}</span>
          {verdicts.length > 0 && <span data-studio-qa-counts="true" aria-label={`${green} green${amber > 0 ? ` · ${amber} amber` : ''}`}>{green} green{amber > 0 ? ` · ${amber} amber` : ''}</span>}
          <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
            <DialogTrigger asChild><button type="button" data-studio-qa-inspect="true" aria-label="Inspect quality checks">Details</button></DialogTrigger>
            <DialogContent data-studio-qa-dialog="true">
              <DialogHeader data-studio-qa-dialog-header="true"><DialogTitle>Quality check details</DialogTitle><DialogDescription>Current reported QA status and skipped-check details.</DialogDescription></DialogHeader>
              <section data-studio-qa-dialog-report="true" tabIndex={0} aria-label="Current quality-check report">
                <p data-studio-qa-dialog-message="true">{latest?.text || 'Running quality checks…'}</p>
                {verdicts.length > 0 && <p data-studio-qa-dialog-counts="true">{green} green{amber > 0 ? ` · ${amber} amber` : ''}</p>}
                {skippedTitle && <p data-studio-qa-dialog-skipped="true">{skippedTitle}</p>}
              </section>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    )
  }

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
