"use client"

import { createElement, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import type { VoiceCallController, VoiceCallSnapshot } from '@/lib/studio-voice-call-controller'
import type { VoiceCallStageProps } from '@/components/builder/voice-call/voice-call-stage'
import type { VoiceAction } from '@/lib/studio-voice-call-ui'
import { STUDIO_VOICE_CALL_BUTTONS, STUDIO_VOICE_CALL_UI_ENABLED, STUDIO_VOICE_COMPANION, companionChoices, isTalkKey, nextCompanion, readCompanionChoice, spaceBelongsToTarget, voiceCallBus, disarmVoiceTurn, writeCompanionChoice, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'

export interface UseStudioVoiceCallOptions {
  /** The Studio shell (the call needs the flag too, read here). Off: nothing is loaded, listened to, timed or asked for. */
  enabled: boolean
  /** The page's ordinary send of typed words (handleSendMessage(undefined, text)); with the call's turn armed, the socket hook makes it a voice turn. */
  sendTurn: (text: string) => Promise<unknown> | unknown
  /** The page's own click on a button of a card (handleActionClick(action, messageId, answerKey)): a spoken "yes" to the plan is that button, sent as a voice turn, marked answered by the click path's own key. */
  sendAction: (action: VoiceAction, messageId: string, answerKey: string) => Promise<unknown> | unknown
  /** The session on screen: a call ends when it changes. */
  sessionKey: string | null
  /** The Director socket is open. */
  connected: boolean
}

export interface StudioVoiceCall {
  /** The call: a stage that fills the chat column while it is on (the composer is not drawn then), and the plain-words notice when the microphone was refused. null otherwise. */
  dock: ReactNode
  /** What the composer's two call buttons get (and `active`: the composer is hidden): null with the flag off, and until the call's code and stylesheet are loaded. */
  composerProps: VoiceCallComposerProps | null
}

const NONE: StudioVoiceCall = { dock: null, composerProps: null }
const noopSubscribe = () => () => {}
const CHOICES = companionChoices(STUDIO_VOICE_COMPANION)
/** This device's storage, or nothing where it is blocked (the accessor itself can throw). */
function deviceStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

/**
 * NEXT_PUBLIC_STUDIO_VOICE_CALL (default off). With it on, the call's controller, the browser's microphone and speaker adapters and the call stage (with its stylesheet, which the two call buttons use too) are loaded
 * when the page mounts (dynamic imports: with the flag off none of it is in the page), the controller is shown Director's frames through the bus the socket hook feeds, and the stage and the composer's two buttons
 * are drawn from its snapshot. The microphone is asked for by a call button and nothing else. Space is the talk key while a call is on (never in a text field).
 */
export function useStudioVoiceCall(options: UseStudioVoiceCallOptions): StudioVoiceCall {
  const enabled = options.enabled && STUDIO_VOICE_CALL_UI_ENABLED
  const { sessionKey } = options
  const live = useRef(options)
  live.current = options
  const [controller, setController] = useState<VoiceCallController | null>(null)
  const [Stage, setStage] = useState<ComponentType<VoiceCallStageProps> | null>(null)
  const [companion, setCompanion] = useState<string>(() => (STUDIO_VOICE_CALL_UI_ENABLED ? readCompanionChoice(deviceStorage(), STUDIO_VOICE_COMPANION) : STUDIO_VOICE_COMPANION)) // this device's character (Felix unless it chose Bob)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let made: VoiceCallController | null = null
    void Promise.all([import('@/lib/studio-voice-call-controller'), import('@/lib/studio-voice-call-browser'), import('@/components/builder/voice-call/voice-call-stage')]).then(([core, browser, stage]) => {
      if (cancelled) return
      made = new core.VoiceCallController({ env: browser.browserVoiceEnv(), port: browser.browserVoicePort(), sendTurn: text => live.current.sendTurn(text), sendAction: (action, messageId, answerKey) => live.current.sendAction(action, messageId, answerKey), isConnected: () => live.current.connected })
      voiceCallBus.frame = made.onFrame
      voiceCallBus.sent = made.onSent
      setStage(() => stage.VoiceCallStage)
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
      setStage(null)
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
      controller.talkPress()
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      if (spaceBelongsToTarget(event.target as HTMLElement | null)) return
      event.preventDefault()
      controller.talkRelease()
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

  if (!enabled || !controller || !snapshot || !Stage) return NONE
  const showDock = snapshot.active || snapshot.starting || !!snapshot.notice
  return {
    dock: showDock
      ? createElement(Stage, {
        snapshot, pack: companion, choices: CHOICES, getLevel: controller.getLevel,
        onChooseCompanion: () => { const next = nextCompanion(companion, CHOICES); writeCompanionChoice(deviceStorage(), next, STUDIO_VOICE_COMPANION); setCompanion(next) },
        onTalkPress: () => controller.talkPress(), onTalkRelease: () => controller.talkRelease(), onStop: () => controller.stop(), onMute: muted => controller.setMuted(muted), onEnd: () => controller.endCall(),
        onRetry: () => { void controller.startCall(controller.getSnapshot().mode) }, onDismissNotice: () => controller.dismissNotice(),
      })
      : null,
    composerProps: { active: snapshot.active || snapshot.starting, busy: snapshot.starting, disabled: false, onStart: mode => { void controller.startCall(mode) }, buttons: STUDIO_VOICE_CALL_BUTTONS },
  }
}
