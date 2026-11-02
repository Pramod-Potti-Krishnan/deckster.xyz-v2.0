"use client"

import React, { useEffect, useState } from 'react'
import { Maximize2, Mic, Minimize2, PhoneOff, Square, X } from 'lucide-react'
import { CompanionPlayer } from './companion-player'
import './voice-call.css'
import type { VoiceCallSnapshot } from '@/lib/studio-voice-call-controller'
import { CHEST_PX, COLLAPSE_LABEL, DISC_PX_DESKTOP, DISC_PX_PHONE, EXPAND_LABEL, TALK_HINT, VOICE_PHONE_MEDIA } from '@/lib/studio-voice-call-ui'

export interface VoiceCallDockProps {
  snapshot: VoiceCallSnapshot
  /** The pack's folder under public/companions/. */
  pack: string
  getLevel: () => number
  onTalkStart: () => void
  onTalkEnd: () => void
  onStop: () => void
  onEnd: () => void
  onToggleExpanded: () => void
  onRetry: () => void
  onDismissNotice: () => void
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(VOICE_PHONE_MEDIA)
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return phone
}

/**
 * The call, docked in the chat column above the composer (NEXT_PUBLIC_STUDIO_VOICE_CALL): the companion in a face disc (88 px, 64 px on a phone) that opens to a chest view (240 px tall), the state chip
 * (Your turn / Listening / Thinking / Speaking), the line being said, what Director is doing, and the controls: hold to talk, Stop, bigger / smaller, End. Presentation only: it holds no call state.
 */
export function VoiceCallDock({ snapshot, pack, getLevel, onTalkStart, onTalkEnd, onStop, onEnd, onToggleExpanded, onRetry, onDismissNotice }: VoiceCallDockProps) {
  const phone = usePhone()
  const { controls, notice, expanded } = snapshot
  const framing = expanded ? 'chest' : 'disc'
  const size = expanded ? CHEST_PX : phone ? DISC_PX_PHONE : DISC_PX_DESKTOP
  const waiting = snapshot.starting
  const caption = waiting ? 'Waiting for your microphone…' : snapshot.caption ?? (snapshot.active ? TALK_HINT : null)
  return (
    <section
      className="studio-voice-dock"
      data-studio-voice-call="dock"
      data-voice-scene={snapshot.scene}
      data-voice-chip={snapshot.chip}
      data-voice-expanded={expanded ? 'true' : 'false'}
      data-voice-phone={phone ? 'true' : 'false'}
      data-voice-active={snapshot.active ? 'true' : 'false'}
      aria-label="Voice call"
    >
      <div className="studio-voice-stage">
        <div className="studio-voice-disc" data-ring={snapshot.scene} data-framing={framing}>
          <CompanionPlayer pack={pack} scene={snapshot.scene} dance={snapshot.dance} framing={framing} size={size} reducedMotion={snapshot.reducedMotion} getLevel={getLevel} />
        </div>
      </div>
      <div className="studio-voice-body">
        <div className="studio-voice-head">
          <span className="studio-voice-chip" data-chip={snapshot.chip} role="status"><i aria-hidden />{snapshot.chip}</span>
          <div className="studio-voice-tools">
            <button type="button" className="studio-voice-icon" disabled={!controls.stop} onClick={onStop} aria-label="Stop" title="Stop">
              <Square aria-hidden className="h-3.5 w-3.5 fill-current" />
            </button>
            <button type="button" className="studio-voice-icon" disabled={!controls.expand} onClick={onToggleExpanded} aria-label={expanded ? COLLAPSE_LABEL : EXPAND_LABEL} aria-pressed={expanded} title={expanded ? COLLAPSE_LABEL : EXPAND_LABEL}>
              {expanded ? <Minimize2 aria-hidden className="h-4 w-4" /> : <Maximize2 aria-hidden className="h-4 w-4" />}
            </button>
            <button type="button" className="studio-voice-icon studio-voice-end" disabled={!controls.end} onClick={onEnd} aria-label="End call" title="End call">
              <PhoneOff aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>
        {caption ? <p className="studio-voice-caption" data-studio-voice-caption={snapshot.caption ? 'line' : 'hint'} aria-live="polite">{caption}</p> : null}
        {snapshot.progress ? <p className="studio-voice-progress" data-studio-voice-progress="true">{snapshot.progress}</p> : null}
      </div>
      <div className="studio-voice-actions">
        <button
          type="button"
          className="studio-voice-talk"
          data-holding={snapshot.holding ? 'true' : 'false'}
          disabled={!controls.talk}
          aria-pressed={snapshot.holding}
          aria-label="Hold to talk"
          title={TALK_HINT}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); onTalkStart() }}
          onPointerUp={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); onTalkEnd() }}
          onPointerCancel={onTalkEnd}
          onContextMenu={event => event.preventDefault()}
          onKeyDown={event => { if (event.key === ' ') event.preventDefault() }}
        >
          <Mic aria-hidden className="h-4 w-4" />
          <span>{snapshot.holding ? 'Release to send' : 'Hold to talk'}</span>
        </button>
      </div>
      {notice ? (
        <div className="studio-voice-notice" role="alert" data-studio-voice-notice={notice.kind}>
          <div>
            <strong>{notice.title}</strong>
            <ol>{notice.steps.map(step => <li key={step}>{step}</li>)}</ol>
          </div>
          <div className="studio-voice-notice-actions">
            {notice.retry ? <button type="button" onClick={onRetry}>Try again</button> : null}
            <button type="button" onClick={onDismissNotice} aria-label="Dismiss"><X aria-hidden className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
