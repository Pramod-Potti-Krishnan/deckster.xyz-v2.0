"use client"

import React from 'react'
import { Phone, Video } from 'lucide-react'
import { StudioComposerHint } from '../studio-composer-hint'
import { CALL_MODES, callButtonLabel, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'

/**
 * The two call buttons beside Send (NEXT_PUBLIC_STUDIO_VOICE_CALL): Audio and Video, one tap each, the same size and colour as Send. A tap starts the call in that mode, and starting the call is the only thing in Studio
 * that asks for the microphone. While a call is on the composer is not drawn at all (chat-input.tsx), so these are never shown then. They hold no state: the page's call hook passes `busy` / `disabled` and the handler.
 * Their look (Send's tokens, the chat-clean size, the larger phone buttons with a word on them) is voice-call.css, which the call hook loads before it hands these props out.
 */
export function VoiceCallButtons({ busy, disabled, onStart, studio }: VoiceCallComposerProps & { studio: boolean }) {
  return (
    <div data-studio-voice-call="buttons" role="group" aria-label="Start a call" className="ml-auto mr-1.5 flex items-center gap-1.5">
      {CALL_MODES.map(mode => {
        const label = callButtonLabel(mode)
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
              onClick={() => onStart(mode)}
            >
              {mode === 'video' ? <Video aria-hidden className="h-4 w-4" /> : <Phone aria-hidden className="h-4 w-4" />}
              <span className="studio-voice-start-word hidden">{mode === 'video' ? 'Video' : 'Audio'}</span>
            </button>
          </StudioComposerHint>
        )
      })}
    </div>
  )
}
