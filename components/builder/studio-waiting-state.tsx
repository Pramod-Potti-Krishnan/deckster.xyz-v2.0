"use client"

import './studio-waiting-state.css'
import type { NarrationState, NarrationPhase } from '@/lib/build-narration-heuristics'

const STUDIO_WAITING = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

export interface StudioWaitingStateProps {
  message?: string
  scope?: 'screen' | 'canvas'
  /** Supplied only while the caller owns a real reply/planning/decision wait. */
  activity?: 'thinking' | 'planning' | 'awaiting_user'
  /** Current owned narration; inactive/restored narration never starts an animation. */
  narration?: NarrationState | null
}

const PHASE_COPY: Record<NarrationPhase | 'thinking', string> = {
  idle: 'Loading builder...', thinking: 'Director is considering your message…',
  planning: 'Shaping your presentation…', strawman: 'Your outline is taking shape…',
  awaiting_user: 'Ready for your decision', building: 'Building your slides…',
  qa: 'Checking your slides…', finalizing: 'Finishing your presentation…',
  complete: 'Your deck is ready', paused: 'Build paused', stopped: 'Build stopped',
  error: 'The build needs attention',
}

/** Pure presentation: supplied events own phase/count/content; CSS motion never advances them. */
export function StudioWaitingState({ message, scope = 'screen', activity, narration }: StudioWaitingStateProps) {
  if (!STUDIO_WAITING) return null
  const current = scope === 'canvas' && narration?.active ? narration : null
  const phase = current?.phase ?? (scope === 'canvas' ? activity : undefined)
  const progressing = Boolean(phase && phase !== 'idle')
  const moving = progressing && !['awaiting_user', 'paused', 'stopped', 'error', 'complete'].includes(phase!)
  const copy = message ?? (current?.phaseLabel || (phase ? PHASE_COPY[phase] : 'Loading builder...'))
  const count = current?.slideCount ?? 0
  const done = current?.slidesDone ?? 0
  const knownCount = Number.isInteger(count) && count > 0
  const knownProgress = knownCount && Number.isInteger(done) && done >= 0 && done <= count
  const ghosts = current?.ghosts.filter(slide => Number.isInteger(slide.index) && slide.index >= 0).slice(0, 4) ?? []
  const latest = current?.deckEvents.slice(-2) ?? []
  return (
    <div data-studio-v4-shell="true" data-studio-waiting="true" data-waiting-scope={scope}
      data-waiting-phase={phase} data-waiting-progress={progressing ? 'true' : undefined}
      data-waiting-motion={moving ? 'true' : undefined} role="status" aria-live="polite" aria-atomic="true">
      {progressing ? <div data-studio-waiting-stage="true">
        <div data-studio-waiting-art="true" aria-hidden="true">
          <span data-studio-waiting-sheet="back" />
          <span data-studio-waiting-sheet="front"><i /><i /><span><i /><i /><i /></span></span>
        </div>
        <div data-studio-waiting-heading="true"><span data-studio-waiting-dot="true" aria-hidden="true" /><p>{copy}</p></div>
        {knownCount && <p data-studio-waiting-tally="true">{knownProgress && !['planning', 'strawman', 'awaiting_user'].includes(phase!)
          ? `${done} of ${count} slides built` : `${count} slides in your outline`}</p>}
        {knownProgress && ['building', 'qa', 'finalizing', 'complete', 'paused', 'stopped', 'error'].includes(phase!) &&
          <progress data-studio-waiting-meter="true" value={done} max={count} aria-label="Slides built" />}
        {ghosts.length > 0 && <ol data-studio-waiting-outline="true" aria-label="Current outline">
          {ghosts.map(slide => <li key={slide.index} data-slide-state={current?.slideStates[slide.index] ?? 'pending'}
            data-slide-focused={current?.focusSlide === slide.index ? 'true' : undefined}>
            <span data-studio-waiting-slide-number="true">{String(slide.index + 1).padStart(2, '0')}</span>
            <div><strong>{slide.title || `Slide ${slide.index + 1}`}</strong>
              {slide.points.length > 0 && <p>{slide.points.slice(0, 2).join(' · ')}</p>}</div>
            <span data-studio-waiting-slide-status="true">{current?.slideStates[slide.index] === 'built' ? 'Built'
              : current?.slideStates[slide.index] === 'error' ? 'Needs attention'
              : current?.slideStates[slide.index] === 'building' ? 'Building' : ''}</span>
          </li>)}
        </ol>}
        {latest.length > 0 && <ul data-studio-waiting-events="true" aria-label="Latest build updates">
          {latest.map(event => <li key={event.id} data-event-status={event.status}>{event.text}</li>)}
        </ul>}
      </div> :
      <div>
        <div data-studio-waiting-spinner="true" aria-hidden="true" />
        <p>{copy}</p>
      </div>}
    </div>
  )
}
