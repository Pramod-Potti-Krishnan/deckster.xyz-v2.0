"use client"

import React from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { StudioComposerHint } from '../studio-composer-hint'
import { callButtonLabel, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'

/**
 * The call button in the composer's toolbar (NEXT_PUBLIC_STUDIO_VOICE_CALL). Tapping it starts the call, and starting the call is the only thing in Studio that asks for the microphone; tapping it again ends the call.
 * It holds no state: the page's call hook passes `active` / `busy` / `disabled` and the handler.
 */
export function VoiceCallButton({ active, busy, disabled, onClick, studio }: VoiceCallComposerProps & { studio: boolean }) {
  const label = callButtonLabel(active)
  return (
    <StudioComposerHint enabled={studio} label={label}>
      <button
        type="button"
        data-studio-voice-call="button"
        data-voice-active={active ? 'true' : 'false'}
        className={`flex items-center justify-center rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900'
            : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
        }`}
        disabled={disabled || busy}
        aria-label={label}
        aria-pressed={active}
        title={studio ? undefined : label}
        onClick={onClick}
      >
        {active ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
      </button>
    </StudioComposerHint>
  )
}
