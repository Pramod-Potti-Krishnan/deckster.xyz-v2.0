"use client"

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { NarrationEvent } from '@/lib/build-narration-heuristics'

// Typed-source stage row (Phase 4 SB beats): Plan → Validate → Render.
// Heuristic/standard-path builds show the single Content dot instead.
const TYPED_STAGES: Array<{ key: string; label: string; match: string[] }> = [
  { key: 'plan', label: 'Plan', match: ['plan'] },
  { key: 'validate', label: 'Validate', match: ['validate'] },
  // 'style' (SB stage_d) rides the Render dot — it is emitted on the wire but
  // was previously unmatched, so a style beat lit nothing.
  { key: 'render', label: 'Render', match: ['render', 'insert', 'style'] },
]

type DotState = 'idle' | 'active' | 'done' | 'error'

function dotStateFor(stageKeys: string[], events: NarrationEvent[], built: boolean): DotState {
  let state: DotState = 'idle'
  for (const ev of events) {
    if (!stageKeys.includes(ev.stage)) continue
    if (ev.status === 'error') return 'error'
    if (ev.status === 'done') state = 'done'
    else if (state !== 'done') state = 'active'
  }
  if (built) return 'done' // error events early-return above
  return state
}

export function StageDots({
  events,
  built,
  typedSource,
  className,
}: {
  events: NarrationEvent[]
  built: boolean
  typedSource: boolean
  className?: string
}) {
  const reduced = useReducedMotion()
  const stages = typedSource
    ? TYPED_STAGES
    : [{ key: 'content', label: 'Content', match: ['content', 'render', 'progress'] }]

  return (
    <div className={['flex items-center gap-3', className || ''].join(' ')} data-testid="bn-stage-dots">
      {stages.map((s) => {
        const state = dotStateFor(s.match, events, built)
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              {state === 'active' && !reduced && (
                <motion.span
                  className="absolute inline-flex h-full w-full rounded-full bg-primary/60"
                  animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  aria-hidden
                />
              )}
              <span
                className={[
                  'relative inline-flex h-2.5 w-2.5 rounded-full',
                  state === 'idle' ? 'bg-muted' : '',
                  state === 'active' ? 'bg-primary' : '',
                  state === 'done' ? 'bg-primary' : '',
                  state === 'error' ? 'bg-destructive' : '',
                ].join(' ')}
              />
            </span>
            <span className={state === 'idle' ? 'text-[10px] text-muted-foreground' : 'text-[10px] font-medium text-foreground'}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
