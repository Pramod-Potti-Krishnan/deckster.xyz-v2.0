"use client"

import React from 'react'
import { Phone, Video } from 'lucide-react'
import { StudioComposerHint } from '../studio-composer-hint'
import { CALL_MODES, callButtonLabel, callButtonWord, type CallButtonsVariant, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'

/**
 * The two call buttons (NEXT_PUBLIC_STUDIO_VOICE_CALL): Audio and Video, one tap each. A tap starts the call in that mode, and starting the call is the only thing in Studio that asks for the microphone.
 * Where they sit is NEXT_PUBLIC_STUDIO_VOICE_CALL_BUTTONS (`buttons`, default "c"): "a" two square buttons beside Send (inside the toolbar); "b" a row of pills (icon + label, the companion accent) just under the chat box;
 * "c" two compact pills (icon + short label) on their own row right under Send, right-aligned, so Send stays the primary button. The composer draws "a" in its toolbar and "b" / "c" under its box (`place`).
 * While a call is on the composer is not drawn at all (chat-input.tsx), so these are never shown then. Their look is voice-call.css.
 */
export function VoiceCallButtons({ busy, disabled, onStart, studio, buttons, place }: VoiceCallComposerProps & { studio: boolean; place: 'toolbar' | 'under' }) {
  const variant: CallButtonsVariant = buttons
  if ((place === 'toolbar') !== (variant === 'a')) return null
  const pill = variant !== 'a'
  return (
    <div data-studio-voice-call="buttons" data-voice-buttons={variant} role="group" aria-label="Start a call" className={pill ? 'studio-voice-pills' : 'ml-auto mr-1.5 flex items-center gap-1.5'}>
      {CALL_MODES.map(mode => {
        const label = callButtonLabel(mode)
        const icon = mode === 'video' ? <Video aria-hidden className="h-4 w-4" /> : <Phone aria-hidden className="h-4 w-4" />
        if (pill) return (
          <button key={mode} type="button" data-studio-voice-call="pill" data-voice-mode={mode} className="studio-voice-pill" disabled={disabled || busy} aria-label={label} title={label} onMouseDown={event => event.preventDefault()} onClick={() => onStart(mode)}>
            {icon}<span>{callButtonWord(mode)}</span>
          </button>
        )
        return (
          <StudioComposerHint key={mode} enabled={studio} label={label}>
            <button
              type="button"
              data-studio-voice-call="button"
              data-voice-mode={mode}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || busy}
              aria-label={label}
              title={studio ? undefined : label}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onStart(mode)}
            >
              {icon}
            </button>
          </StudioComposerHint>
        )
      })}
    </div>
  )
}
