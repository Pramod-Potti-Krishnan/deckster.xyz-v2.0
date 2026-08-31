"use client"

import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { NarrationState } from '@/lib/build-narration-heuristics'
import { PRESENCE_SHUFFLE_S } from './motion'

export interface DirectorPresenceProps {
  narration: NarrationState
  currentStatus: { status: string; text: string } | null
  className?: string
}

/**
 * The chat-side "Director is thinking" presence row: a deck-of-cards shuffle
 * micro-animation + the live status line, with an expandable build log
 * (the chain-of-thought that used to render as chat bubbles).
 * Visible whenever a build narration is active OR the Director is
 * thinking/generating on an ordinary turn.
 */
export function DirectorPresence({ narration, currentStatus, className }: DirectorPresenceProps) {
  const reduced = useReducedMotion()
  const [logOpen, setLogOpen] = useState(false)

  const statusActive = currentStatus?.status === 'thinking' || currentStatus?.status === 'generating'
  const visible = narration.active || statusActive
  if (!visible) return null

  const line =
    (narration.active && narration.phaseLabel) ||
    currentStatus?.text ||
    'Working on it…'

  const logLines = narration.deckEvents.slice(-30)

  return (
    <div
      className={[
        'border-t border-border bg-card px-3 py-2',
        className || '',
      ].join(' ')}
      data-testid="bn-presence"
    >
      <div className="flex items-center gap-2.5">
        <DeckShuffle reduced={!!reduced} paused={narration.phase === 'paused' || narration.phase === 'stopped'} />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
          {line}
        </span>
        {narration.deckEvents.length > 0 && (
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="flex shrink-0 items-center gap-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {logOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            Build log
          </button>
        )}
      </div>
      {logOpen && (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pl-1">
          {logLines.map((ev) => (
            <li key={ev.id} className="text-[11px] leading-4 text-muted-foreground">
              {ev.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Three stacked mini-cards; the top card lifts and slides to the back. */
function DeckShuffle({ reduced, paused }: { reduced: boolean; paused: boolean }) {
  if (reduced || paused) {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-primary/60"
          animate={reduced || paused ? undefined : { scale: [1, 1.6], opacity: [0.7, 0] }}
        />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
    )
  }
  return (
    <span className="relative block h-5 w-7 shrink-0" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute left-0 top-0 block h-4 w-6 rounded-[3px] border border-primary/40 bg-primary/15"
          style={{ zIndex: 3 - i }}
          animate={{
            y: [i * 1.5, i * 1.5 - 6, i * 1.5],
            x: [i * 1, i * 1 + 3, i * 1],
            zIndex: [3 - i, 3 - i, ((3 - i) % 3) + 1],
          }}
          transition={{
            repeat: Infinity,
            duration: PRESENCE_SHUFFLE_S,
            delay: (i * PRESENCE_SHUFFLE_S) / 3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}
