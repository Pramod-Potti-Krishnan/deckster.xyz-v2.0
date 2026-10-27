"use client"

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, OctagonPause } from 'lucide-react'
import type { NarrationState } from '@/lib/build-narration-heuristics'
import { phaseLabelFor } from '@/lib/build-narration-heuristics' // PAUSED-LABEL
import { StageIcon } from './stage-icons'
import { PauseStopControl, type PauseStopControlProps } from './pause-stop-control'
import { PHASE_SWAP_S } from './motion'
import './studio-build-status.css'

export interface StageRibbonProps {
  narration: NarrationState
  control?: Omit<PauseStopControlProps, 'control' | 'slidesDone' | 'slideCount'>
  className?: string
}

function Elapsed({ startedAt, halted }: { startedAt: number | null; halted: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (halted) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [halted])
  if (!startedAt) return null
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return (
    <span data-studio-build-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'elapsed' : undefined} className="tabular-nums text-xs text-muted-foreground">{mm}:{ss}</span>
  )
}

/** Representative stage slug per phase, for the leading icon. */
const PHASE_STAGE: Record<string, string> = {
  planning: 'framing',
  strawman: 'outline',
  awaiting_user: 'outline',
  building: 'render',
  qa: 'qa',
  finalizing: 'package',
}

/**
 * Canvas v2 R2 — the slim status row ABOVE the slide: phase icon + headline +
 * elapsed + slide tally + Pause/Stop. Mounted whenever narration is active, so
 * the controls are reachable in every phase (incl. error, which v1 lacked).
 */
export function StageRibbon({ narration: n, control, className }: StageRibbonProps) {
  // PAUSED-LABEL (NEXT_PUBLIC_STUDIO_PAUSED_LABEL, default off): while the control state is paused the headline reads the existing "Paused" label, whatever phase the build is in. The reducer lets a "building" status move a
  // PAUSED-LABEL: paused build's phase back to "building" (control stays paused), so Resume showed under "Building your slides…". Only the headline: the icon, the timer, the count and the buttons read what they read today.
  n = process.env.NEXT_PUBLIC_STUDIO_PAUSED_LABEL === 'true' && n.control === 'paused' ? { ...n, phaseLabel: phaseLabelFor('paused') } : n // PAUSED-LABEL
  const isHalted = n.phase === 'paused' || n.phase === 'stopped'
  const isError = n.phase === 'error'
  const isComplete = n.phase === 'complete'
  // Decision gates freeze the clock (PK 2026-09-03): the reducer shifts
  // startedAt on exit so the wait is never counted; freezing the display here
  // keeps the shown value from creeping while waiting.
  const isWaiting = n.phase === 'awaiting_user'
  const latestDeck = n.deckEvents.length ? n.deckEvents[n.deckEvents.length - 1] : null
  const lastErrorText = isError
    ? [...n.deckEvents].reverse().find((e) => e.status === 'error')?.text || 'The build hit an error.'
    : null
  // PASS2B J1-15 (flag NEXT_PUBLIC_STUDIO_BUILD_ERROR_STATE, Studio shell only, default off): a build that failed has nothing to pause or stop, so
  // Pause and Stop are not offered, and one line says what is kept and how to try again. Presentation only: it reads the phase this ribbon already
  // has, adds no state or effect, and sends nothing (the way to retry is the message box, as the recovery card already says).
  const buildErrorState = isError
    && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_BUILD_ERROR_STATE === 'true'

  return (
    <div
      className={[
        'flex items-center justify-between gap-3 px-4 py-2',
        className || '',
      ].join(' ')}
      data-testid="bn-stage-ribbon"
      data-studio-build-ribbon={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'true' : undefined}
      data-studio-build-phase={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? n.phase : undefined}
      role="status"
      aria-label="Deck build progress"
    >
      <div data-studio-build-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'summary' : undefined} className="flex min-w-0 items-center gap-2.5">
        <span
          data-studio-build-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'icon' : undefined}
          className={[
            'flex h-6 w-6 flex-none items-center justify-center rounded-full',
            isError
              ? 'bg-destructive/15 text-destructive'
              : isComplete
                ? 'bg-primary/15 text-primary'
                : isHalted
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary',
          ].join(' ')}
        >
          {isComplete ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : isHalted ? (
            <OctagonPause className="h-3.5 w-3.5" aria-hidden />
          ) : isError ? (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <StageIcon stage={PHASE_STAGE[n.phase] || latestDeck?.stage} className="h-3.5 w-3.5" />
          )}
        </span>
        <div data-studio-build-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'headline' : undefined} className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={n.phaseLabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: PHASE_SWAP_S }}
              className={[
                'truncate text-sm font-semibold',
                isError ? 'text-destructive' : 'text-foreground',
              ].join(' ')}
            >
              {n.phaseLabel}
            </motion.p>
          </AnimatePresence>
          {isError && lastErrorText ? (
            <p data-studio-build-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'error' : undefined} className="truncate text-xs text-destructive/80">{lastErrorText}</p>
          ) : null}
          {buildErrorState ? (
            <p data-studio-build-part="error-recovery" className="text-xs text-muted-foreground">Your outline and any finished slides are saved. Send a message to try again.</p>
          ) : null}
        </div>
        <Elapsed startedAt={n.startedAt} halted={isHalted || isComplete || isError || isWaiting} />
        {n.slideCount > 0 && (n.phase === 'building' || n.phase === 'qa' || n.phase === 'finalizing' || isHalted) && (
          <span data-studio-build-part={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'count' : undefined} className="flex-none text-xs text-muted-foreground">
            {n.slidesDone} of {n.slideCount} built
          </span>
        )}
      </div>
      {control && !buildErrorState ? (
        <PauseStopControl
          {...control}
          control={n.control}
          slidesDone={n.slidesDone}
          slideCount={n.slideCount}
        />
      ) : null}
    </div>
  )
}
