"use client"

import React from 'react'
import { Play, RotateCcw } from 'lucide-react'
import type { FlowAmendState } from '@/lib/studio-flow-control'
import { FLOW_AMEND_REBUILD_LABEL } from '@/lib/studio-flow-control'

export interface FlowAmendBarProps {
  /** The decision, from flowAmendState (lib/studio-flow-control.ts). Nothing is drawn unless it is visible. */
  state: FlowAmendState
  onResume: () => void
  onRebuild: () => void
}

/**
 * NEXT_PUBLIC_STUDIO_FLOW_AMEND: the calm line above the composer while a build is held ("Paused — type changes, then
 * Resume or Rebuild.") and the two ways forward. Presentation only: it holds no state and sends nothing; the page owns
 * Resume (build_control) and Rebuild (stop, wait, send the draft).
 */
export function FlowAmendBar({ state, onResume, onRebuild }: FlowAmendBarProps) {
  if (!state.visible) return null
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border bg-muted/40 px-3 py-2"
      data-testid="bn-flow-amend"
      data-flow-amend={state.key ?? undefined}
    >
      <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs text-muted-foreground" data-testid="bn-flow-amend-line">
        {state.line}
      </p>
      {(state.showResume || state.showRebuild) && (
        <div className="flex flex-none items-center gap-1.5">
          {state.showResume && (
            <button
              type="button"
              onClick={onResume}
              disabled={!state.resumeEnabled}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="bn-flow-amend-resume"
            >
              <Play className="h-3 w-3" aria-hidden />
              {state.resumeLabel}
            </button>
          )}
          {state.showRebuild && (
            <button
              type="button"
              onClick={onRebuild}
              disabled={!state.rebuildEnabled}
              title={state.rebuildHint ?? undefined}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="bn-flow-amend-rebuild"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              {FLOW_AMEND_REBUILD_LABEL}
            </button>
          )}
        </div>
      )}
      {state.resumeHint ? (
        <p className="w-full text-[11px] text-muted-foreground" data-testid="bn-flow-amend-hint">{state.resumeHint}</p>
      ) : null}
    </div>
  )
}
