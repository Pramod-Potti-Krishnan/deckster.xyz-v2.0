"use client"

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export interface StagePlaceholderProps {
  /** overlay: absolute inset-0 inside the sized 16:9 slide box (blank deck
   *  underneath). standalone: renders its own aspect-video box (no-URL case). */
  mode: 'overlay' | 'standalone'
  /** Renders the quiet "Start on this blank canvas" dismiss affordance. */
  onDismiss?: () => void
  className?: string
}

/**
 * Canvas v2 R1 — the designed landing state. Sits at exact slide geometry:
 * in overlay mode geometry is inherited from the viewer's fit-contain box, so
 * it tracks chat-drawer resizes for free.
 */
export function StagePlaceholder({ mode, onDismiss, className }: StagePlaceholderProps) {
  const reduced = useReducedMotion()

  const inner = (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-card text-center shadow-2xl">
      {/* quiet grid backdrop, matching the narration family */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <motion.div
        className="relative flex flex-col items-center px-8"
        animate={reduced ? undefined : { y: [0, -6, 0] }}
        transition={reduced ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img src="/logo-icon.png" alt="" aria-hidden className="mb-4 h-14 w-14 opacity-50" />
        <p className="text-lg font-medium text-foreground">Your deck will appear here</p>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Tell Director what you want to build — you&apos;ll watch it take shape right on this stage.
        </p>
      </motion.div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute bottom-3 right-4 rounded-md px-2 py-1 text-xs text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          data-testid="bn-placeholder-dismiss"
        >
          Start on this blank canvas
        </button>
      )}
    </div>
  )

  if (mode === 'overlay') {
    return (
      <div className={['absolute inset-0 z-30', className || ''].join(' ')} data-testid="bn-stage-placeholder">
        {inner}
      </div>
    )
  }
  return (
    <div
      className={['aspect-video w-full max-w-5xl', className || ''].join(' ')}
      data-testid="bn-stage-placeholder"
    >
      {inner}
    </div>
  )
}
