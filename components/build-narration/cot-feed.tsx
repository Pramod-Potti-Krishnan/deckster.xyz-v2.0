"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { NarrationEvent } from '@/lib/build-narration-heuristics'
import { COT_LINE_ENTER_S } from './motion'

const VISIBLE_LINES = 5

/**
 * Deck-scope chain-of-thought stream: newest line types on, previous lines dim
 * and stack; older lines collapse behind an expander.
 */
export function CoTFeed({ events, className }: { events: NarrationEvent[]; className?: string }) {
  const reduced = useReducedMotion()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? events : events.slice(-VISIBLE_LINES)
  const hiddenCount = events.length - visible.length

  return (
    <div className={className} data-testid="bn-cot-feed">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ChevronDown className="h-3 w-3" />
          {hiddenCount} earlier steps
        </button>
      )}
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visible.map((ev, i) => {
            const isLatest = i === visible.length - 1
            return (
              <motion.li
                key={ev.id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: isLatest ? 1 : 0.55, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: COT_LINE_ENTER_S, ease: 'easeOut' }}
                className={
                  isLatest
                    ? 'text-sm text-foreground'
                    : 'text-xs text-muted-foreground'
                }
              >
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary/70 align-middle" aria-hidden />
                {ev.text}
                {ev.detail ? (
                  <span className="block pl-3 text-xs text-muted-foreground">{ev.detail}</span>
                ) : null}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}
