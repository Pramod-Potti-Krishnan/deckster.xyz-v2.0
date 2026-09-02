"use client"

import React, { useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { NarrationControl } from '@/lib/build-narration-heuristics'
import { isBuildControlRequestPending } from '@/lib/build-control-helpers'

export interface PauseStopControlProps {
  /** NEXT_PUBLIC_BUILD_CONTROL — renders nothing when false (Phase 5 flag). */
  enabled: boolean
  control: NarrationControl
  slidesDone: number
  slideCount: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

/**
 * Pause / Resume / Stop for a running build. Optimistic labels until the
 * Director ack (build_phase paused/stopped) flips the control state.
 * Stop is NON-DESTRUCTIVE by contract (plan §12 #6): built slides and the
 * strawman are always kept.
 */
export function PauseStopControl({
  enabled,
  control,
  slidesDone,
  slideCount,
  onPause,
  onResume,
  onStop,
}: PauseStopControlProps) {
  const [confirmStop, setConfirmStop] = useState(false)
  if (!enabled) return null

  const pausing = control === 'pause_requested'
  const paused = control === 'paused'
  const resuming = control === 'resume_requested'
  const stopping = control === 'stop_requested'
  const stopped = control === 'stopped'
  const pending = isBuildControlRequestPending(control)

  return (
    <div className="flex items-center gap-1.5" data-testid="bn-controls">
      {!paused && !stopped && !resuming && (
        <button
          type="button"
          onClick={onPause}
          disabled={pending}
          className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pause className="h-3 w-3" />
          {pausing ? 'Pausing…' : 'Pause'}
        </button>
      )}
      {(paused || stopped || resuming) && (
        <button
          type="button"
          onClick={onResume}
          disabled={resuming}
          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Play className="h-3 w-3" />
          {resuming ? 'Resuming…' : 'Resume'}
        </button>
      )}
      {!stopped && (
        <button
          type="button"
          onClick={() => setConfirmStop(true)}
          disabled={pending}
          className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Square className="h-3 w-3" />
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      )}

      <AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop building?</AlertDialogTitle>
            <AlertDialogDescription>
              {slidesDone > 0
                ? `The ${slidesDone} finished slide${slidesDone === 1 ? '' : 's'} (of ${slideCount}) will be kept, and you can resume later from where it stopped.`
                : 'Progress so far will be kept, and you can resume later from where it stopped.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep building</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmStop(false)
                onStop()
              }}
            >
              Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
