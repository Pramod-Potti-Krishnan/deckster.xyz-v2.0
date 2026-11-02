"use client"

import { createElement, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { VoiceCallController, VoiceCallSnapshot } from '@/lib/studio-voice-call-controller'
import type { VoiceAction } from '@/lib/studio-voice-call-ui'
import { STUDIO_VOICE_CALL_UI_ENABLED, STUDIO_VOICE_COMPANION, isTalkKey, spaceBelongsToTarget, voiceCallBus, disarmVoiceTurn, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'

export interface UseStudioVoiceCallOptions {
  /** The Studio shell (the call needs the flag too, read here). Off: nothing is loaded, listened to, timed or asked for. */
  enabled: boolean
  /** The page's ordinary send of typed words (handleSendMessage(undefined, text)); with the call's turn armed, the socket hook makes it a voice turn. */
  sendTurn: (text: string) => Promise<unknown> | unknown
  /** The page's own click on a button of a card (handleActionClick): a spoken "yes" to the plan is that button, sent as a voice turn. */
  sendAction: (action: VoiceAction, messageId: string) => Promise<unknown> | unknown
  /** The session on screen: a call ends when it changes. */
  sessionKey: string | null
  /** The Director socket is open. */
  connected: boolean
}

export interface StudioVoiceCall {
  /** The docked companion, above the composer: null until a call starts (or the microphone is refused). */
  dock: ReactNode
  /** What the composer's call button gets: null with the flag off. */
  composerProps: VoiceCallComposerProps | null
}

/** The dock (and the companion player, its stylesheet and its icons) is its own chunk, fetched when a call first draws it: a page with the flag off never loads it. */
const VoiceCallDock = dynamic(() => import('@/components/builder/voice-call/voice-call-dock').then(module => module.VoiceCallDock), { ssr: false })

const NONE: StudioVoiceCall = { dock: null, composerProps: null }
const noopSubscribe = () => () => {}

/**
 * NEXT_PUBLIC_STUDIO_VOICE_CALL (default off). With it on, the call's controller and the browser's microphone and speaker adapters are loaded when the page mounts (a dynamic import: with the flag off
 * nothing of the core is in the page), the controller is shown Director's frames through the bus the socket hook feeds, and the dock and the composer button are drawn from its snapshot. The microphone is
 * asked for by the call button and nothing else. Space is the talk key while a call is on (never in a text field).
 */
export function useStudioVoiceCall(options: UseStudioVoiceCallOptions): StudioVoiceCall {
  const enabled = options.enabled && STUDIO_VOICE_CALL_UI_ENABLED
  const { sessionKey } = options
  const live = useRef(options)
  live.current = options
  const [controller, setController] = useState<VoiceCallController | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let made: VoiceCallController | null = null
    void Promise.all([import('@/lib/studio-voice-call-controller'), import('@/lib/studio-voice-call-browser')]).then(([core, browser]) => {
      if (cancelled) return
      made = new core.VoiceCallController({ env: browser.browserVoiceEnv(), port: browser.browserVoicePort(), sendTurn: text => live.current.sendTurn(text), sendAction: (action, messageId) => live.current.sendAction(action, messageId), isConnected: () => live.current.connected })
      voiceCallBus.frame = made.onFrame
      voiceCallBus.sent = made.onSent
      setController(made)
    })
    return () => {
      cancelled = true
      if (made) {
        if (voiceCallBus.frame === made.onFrame) voiceCallBus.frame = null
        if (voiceCallBus.sent === made.onSent) voiceCallBus.sent = null
        made.dispose()
      }
      disarmVoiceTurn()
      setController(null)
    }
  }, [enabled])

  const snapshot: VoiceCallSnapshot | null = useSyncExternalStore(
    controller ? controller.subscribe : noopSubscribe,
    () => (controller ? controller.getSnapshot() : null),
    () => null,
  )

  // The session on screen changed: the call is over (its microphone is released).
  const lastSession = useRef(sessionKey)
  useEffect(() => {
    if (lastSession.current !== sessionKey) { lastSession.current = sessionKey; controller?.endCall() }
  }, [sessionKey, controller])

  // Space is the talk key while a call is on, anywhere but in a text field; losing the window lets go.
  const active = !!snapshot?.active
  useEffect(() => {
    if (!controller || !active) return
    const down = (event: KeyboardEvent) => {
      if (!isTalkKey(event) || spaceBelongsToTarget(event.target as HTMLElement | null)) return
      event.preventDefault()
      controller.pttDown()
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      if (spaceBelongsToTarget(event.target as HTMLElement | null)) return
      event.preventDefault()
      void controller.pttUp()
    }
    const release = () => { void controller.pttUp() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
    }
  }, [controller, active])

  const toggle = useCallback(() => {
    if (!controller) return
    const current = controller.getSnapshot()
    if (current.active || current.starting) controller.endCall()
    else void controller.startCall()
  }, [controller])

  if (!enabled || !controller || !snapshot) return NONE
  const showDock = snapshot.active || snapshot.starting || !!snapshot.notice
  return {
    dock: showDock
      ? createElement(VoiceCallDock, {
        snapshot, pack: STUDIO_VOICE_COMPANION, getLevel: controller.getLevel,
        onTalkStart: () => controller.pttDown(), onTalkEnd: () => { void controller.pttUp() }, onStop: () => controller.stop(), onEnd: () => controller.endCall(),
        onToggleExpanded: () => controller.setExpanded(!controller.getSnapshot().expanded), onRetry: () => { void controller.startCall() }, onDismissNotice: () => controller.dismissNotice(),
      })
      : null,
    composerProps: { active: snapshot.active || snapshot.starting, busy: snapshot.starting, disabled: false, onClick: toggle },
  }
}
