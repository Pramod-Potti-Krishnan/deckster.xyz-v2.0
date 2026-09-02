"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CheckCircle2, OctagonPause } from 'lucide-react'
import type { NarrationState } from '@/lib/build-narration-heuristics'
import { CoTFeed } from './cot-feed'
import { GhostDeckRail } from './ghost-deck-rail'
import { FocusSlideCard } from './focus-slide-card'
import { QASweep } from './qa-sweep'
import { PauseStopControl, type PauseStopControlProps } from './pause-stop-control'
import { OVERLAY_DISSOLVE_S, PHASE_SWAP_S } from './motion'

export interface BuildCanvasProps {
  narration: NarrationState
  onPin: (slideIndex: number | null) => void
  control?: Omit<PauseStopControlProps, 'control' | 'slidesDone' | 'slideCount'>
}

/**
 * The Build Narration Canvas — a stage overlay that IS the build while the
 * deck is being made: thinking feed (P1) → ghost strawman cascade (P2) →
 * per-slide build narration (P3) → QA sweep (P4, Phase 6) → completion settle
 * (P5) → paused/stopped states (P6).
 */
export function BuildCanvas({ narration, onPin, control }: BuildCanvasProps) {
  const reduced = useReducedMotion()
  const n = narration

  // D11 — outline walkthrough: during the strawman phase the focus card steps
  // through each slide's outline on its own. A user pin always wins; reduced
  // motion holds on the first slide.
  const [walkIdx, setWalkIdx] = useState<number | null>(null)
  const inWalkPhase = n.phase === 'strawman' || n.phase === 'awaiting_user'
  useEffect(() => {
    if (!inWalkPhase || n.ghosts.length === 0) {
      setWalkIdx(null)
      return
    }
    if (reduced) {
      setWalkIdx(0)
      return
    }
    setWalkIdx(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      if (i >= n.ghosts.length) {
        clearInterval(t)
        return
      }
      setWalkIdx(i)
    }, 1400)
    return () => clearInterval(t)
  }, [inWalkPhase, n.ghosts.length, reduced])

  const effectiveFocusSlide =
    n.focusSlide !== null
      ? n.focusSlide
      : inWalkPhase && walkIdx !== null
        ? (n.ghosts[Math.min(walkIdx, n.ghosts.length - 1)]?.index ?? null)
        : null

  const focusGhost = useMemo(() => {
    if (effectiveFocusSlide === null) return n.ghosts[0] ?? null
    return n.ghosts.find((g) => g.index === effectiveFocusSlide) ?? n.ghosts[0] ?? null
  }, [effectiveFocusSlide, n.ghosts])

  const showGhostContent = n.ghosts.length > 0
  const isTerminal = n.phase === 'complete'
  const isHalted = n.phase === 'paused' || n.phase === 'stopped'

  return (
    <AnimatePresence>
      {n.active && (
        <motion.div
          key="bn-canvas"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: OVERLAY_DISSOLVE_S }}
          className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-background/90 backdrop-blur-sm"
          data-testid="bn-canvas"
          role="status"
          aria-label="Deck build progress"
        >
          {/* Ambient grid backdrop (quiet homage to the previous loader) */}
          {!reduced && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
              }}
              animate={{ x: [0, 24], y: [0, 24] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            />
          )}

          {/* Header: phase headline + elapsed + controls */}
          <div className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4">
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={n.phaseLabel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: PHASE_SWAP_S }}
                  className="truncate text-base font-semibold text-foreground"
                >
                  {n.phaseLabel}
                </motion.h2>
              </AnimatePresence>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Elapsed startedAt={n.startedAt} halted={isTerminal || isHalted} />
                {n.slideCount > 0 && (n.phase === 'building' || isHalted) && (
                  <span>
                    {n.slidesDone} of {n.slideCount} slides built
                  </span>
                )}
              </div>
            </div>
            {control && (
              <PauseStopControl
                {...control}
                control={n.control}
                slidesDone={n.slidesDone}
                slideCount={n.slideCount}
              />
            )}
          </div>

          {/* Body */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-4 pt-3">
            {isTerminal ? (
              <CompletionState slidesDone={n.slidesDone} startedAt={n.startedAt} />
            ) : n.phase === 'qa' ? (
              // P4 — quality check: deck rail stays visible under a light sweep.
              <div className="relative flex min-h-0 flex-1 flex-col gap-3">
                <QASweep events={n.deckEvents} className="absolute inset-0" />
                <div className="flex flex-1 items-end justify-center" />
                <GhostDeckRail
                  ghosts={n.ghosts}
                  slideStates={n.slideStates}
                  thumbnails={n.thumbnails}
                  qaVerdicts={n.qaVerdicts}
                  focusSlide={n.focusSlide}
                  pinnedSlide={n.pinnedSlide}
                  onPin={onPin}
                  className="relative shrink-0"
                />
              </div>
            ) : isHalted ? (
              <HaltedState narration={n} />
            ) : !showGhostContent ? (
              // P1 — pre-strawman thinking: the CoT feed is the hero.
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <CoTFeed events={n.deckEvents} className="w-full max-w-md" />
              </div>
            ) : (
              // P2/P3 — ghost deck + focus card + side feed.
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex min-h-0 flex-1 items-start justify-center gap-6 overflow-y-auto">
                  <FocusSlideCard
                    ghost={focusGhost}
                    state={focusGhost ? n.slideStates[focusGhost.index] || 'pending' : 'pending'}
                    events={focusGhost ? n.slideEvents[focusGhost.index] || [] : []}
                    thumbnail={focusGhost ? n.thumbnails[focusGhost.index] : undefined}
                    typedSource={n.source === 'typed'}
                    isPinned={n.pinnedSlide !== null}
                    onTogglePin={() =>
                      onPin(n.pinnedSlide !== null ? null : focusGhost ? focusGhost.index : null)
                    }
                    className="min-w-0 flex-1"
                  />
                  <CoTFeed events={n.deckEvents} className="hidden w-64 shrink-0 lg:block" />
                </div>
                <GhostDeckRail
                  ghosts={n.ghosts}
                  slideStates={n.slideStates}
                  thumbnails={n.thumbnails}
                  qaVerdicts={n.qaVerdicts}
                  focusSlide={effectiveFocusSlide}
                  pinnedSlide={n.pinnedSlide}
                  onPin={onPin}
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Elapsed({ startedAt, halted }: { startedAt: number | null; halted: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (halted || !startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [halted, startedAt])
  if (!startedAt) return null
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return <span>{mm}:{ss}</span>
}

function CompletionState({ slidesDone, startedAt }: { slidesDone: number; startedAt: number | null }) {
  const secs = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : null
  const mm = secs !== null ? Math.floor(secs / 60) : 0
  const ss = secs !== null ? String(secs % 60).padStart(2, '0') : '00'
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm"
      >
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="text-sm text-foreground">
          Built {slidesDone} slide{slidesDone === 1 ? '' : 's'}
          {secs !== null ? ` · ${mm}:${ss}` : ''}
        </span>
      </motion.div>
    </div>
  )
}

function HaltedState({ narration: n }: { narration: NarrationState }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
          <OctagonPause className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {n.phase === 'paused' ? 'Paused' : 'Stopped'} — {n.slidesDone} of {n.slideCount || '?'} slides built.
            Your progress is saved.
          </span>
        </div>
      </div>
      {n.ghosts.length > 0 && (
        <GhostDeckRail
          ghosts={n.ghosts}
          slideStates={n.slideStates}
          thumbnails={n.thumbnails}
          qaVerdicts={n.qaVerdicts}
          focusSlide={n.focusSlide}
          pinnedSlide={n.pinnedSlide}
          onPin={() => {}}
          className="shrink-0"
        />
      )}
    </div>
  )
}
