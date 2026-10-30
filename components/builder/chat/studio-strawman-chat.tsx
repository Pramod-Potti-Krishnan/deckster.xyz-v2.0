"use client"

// STRAWMAN CHAT (NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT, default off; lib/studio-strawman-chat.ts decides everything). Two small pieces, mounted only with the flag on:
//   StudioStrawmanChatLine     the chat's ONE quiet status line while a build is narrated and the stage is hidden ("Drafting your outline… 0:18"); nothing once the stage is open
//   StudioStrawmanOutlineCard  the outline card without the numbered slide list (heading, the deck's title, one summary line, the canvas note)
import React, { useEffect, useState } from 'react'
import { ListOrdered } from 'lucide-react'
import { strawmanChatLine, strawmanChatOutlineModel } from '@/lib/studio-strawman-chat'
import './studio-strawman-chat.css'

export interface StudioStrawmanChatLineProps {
  narration: { active: boolean; phase: string; control: string; startedAt: number | null }
  /** The stage is open: the chat says nothing. */
  stageOpen: boolean
  autoProceed: boolean
  /** A held build is already said by a bar above the composer. */
  heldCovered: boolean
  loadingSession?: boolean
}

export function StudioStrawmanChatLine({ narration, stageOpen, autoProceed, heldCovered, loadingSession }: StudioStrawmanChatLineProps) {
  const [now, setNow] = useState(() => Date.now())
  const read = (at: number) => strawmanChatLine({ enabled: true, active: narration.active, phase: narration.phase, control: narration.control, startedAt: narration.startedAt, now: at, stageOpen, autoProceed, heldCovered })
  const running = read(now)?.running === true
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  const line = read(now)
  if (!line) return null
  return (
    <p data-studio-strawman-chat-line={narration.phase} role="status" aria-live="polite" hidden={loadingSession ? true : undefined}>
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      <span data-studio-strawman-chat-words="true">{line.words}</span>
      {line.elapsed ? <span data-studio-strawman-chat-elapsed="true" aria-hidden="true">{line.elapsed}</span> : null}
    </p>
  )
}

export interface StudioStrawmanOutlineCardProps {
  payload: { metadata: { main_title: string; presentation_duration: number | string; overall_theme?: string | null; target_audience?: string | null }; slides: ReadonlyArray<unknown> }
  historyStatus?: 'earlier' | 'current'
  onCanvas?: boolean
  canvasSuperseded?: boolean
  outlineLabel?: boolean
  deckSlideCount?: number | null
}

/** The outline card with the slide list left out: the same markup and data attributes as StudioOutlineCard, so the same stylesheet draws it. */
export function StudioStrawmanOutlineCard({ payload, historyStatus, onCanvas, canvasSuperseded, outlineLabel, deckSlideCount }: StudioStrawmanOutlineCardProps) {
  const model = strawmanChatOutlineModel({
    mainTitle: payload.metadata.main_title, slideCount: payload.slides.length, durationMinutes: payload.metadata.presentation_duration, overallTheme: payload.metadata.overall_theme,
    audience: payload.metadata.target_audience, historyStatus, onCanvas, canvasSuperseded, outlineLabel, deckSlideCount,
  })
  const card = (
    <section data-studio-director-part={model.part} aria-label={model.ariaLabel}>
      <div data-studio-director-part="outline-review-heading"><ListOrdered size={13} aria-hidden="true" /><span>{model.heading}</span></div>
      {model.currentNote && <p className="text-xs text-muted-foreground">{model.currentNote}</p>}
      <h3>{model.title}</h3>
      <p data-studio-director-part="outline-review-meta">{model.meta}</p>
      {model.deckCount ? <p data-studio-director-part="outline-review-deck-count">{model.deckCount}</p> : null}
      {model.audience && <p data-studio-director-part="outline-review-audience">For {model.audience}</p>}
      {model.canvasNote ? <p data-studio-director-part="outline-review-canvas-note">{model.canvasNote}</p> : null}
      {model.supersededNote ? <p data-studio-director-part="outline-review-superseded-note">{model.supersededNote}</p> : null}
    </section>
  )
  return model.historySummary ? <details data-studio-director-part="outline-history" className="mt-2 rounded-lg border p-3">
    <summary className="cursor-pointer text-xs font-medium">{model.historySummary}</summary>
    <p className="text-xs text-muted-foreground">Previous outline notes. Expand to compare with the current outline.</p>
    {card}
  </details> : card
}
