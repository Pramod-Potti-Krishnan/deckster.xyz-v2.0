"use client"

import { createElement, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import type { VoiceCallController, VoiceCallSnapshot } from '@/lib/studio-voice-call-controller'
import type { VoiceCallStageProps } from '@/components/builder/voice-call/voice-call-stage'
import type { VoiceAction } from '@/lib/studio-voice-call-ui'
import { STUDIO_VOICE_CALL_BUTTONS, STUDIO_VOICE_CALL_UI_ENABLED, STUDIO_VOICE_COMPANION, companionChoices, isTalkKey, nextCompanion, readCompanionChoice, spaceBelongsToTarget, voiceCallBus, disarmVoiceTurn, writeCompanionChoice, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'
import { COMPANION_STORAGE_KEY, companionChoicesWithMine } from '@/lib/studio-voice-call-ui' // MY-COMPANIONS
import { STUDIO_MY_COMPANIONS_ENABLED, myCompanionNames, reachableCompanions, rememberMyCompanion, type MyCompanion } from '@/lib/studio-my-companions' // MY-COMPANIONS

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
const NO_COMPANIONS: readonly MyCompanion[] = [] // MY-COMPANIONS: none of the owner's own (the flag off, none listed, or none whose pack answers): the call offers CHOICES, as before
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
  const [mine, setMine] = useState<readonly MyCompanion[]>(NO_COMPANIONS) // MY-COMPANIONS: the owner's own companions whose pack answers (NEXT_PUBLIC_STUDIO_MY_COMPANIONS)
  const choices = mine.length ? companionChoicesWithMine(STUDIO_VOICE_COMPANION, mine.map(entry => entry.id)) : CHOICES // MY-COMPANIONS: the cast, then the owner's own; none: CHOICES itself
  const names = mine.length ? myCompanionNames(mine) : undefined // MY-COMPANIONS: what the owner's own go by (none: the stage's own words)

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
  // MY-COMPANIONS (NEXT_PUBLIC_STUDIO_MY_COMPANIONS, default off: none of this runs): once, after mount, the owner's own companions are asked for and only those whose pack answers are kept (one that does not never reaches
  // MY-COMPANIONS the switch: the call stays on the cast, and the player still falls back to the pack's portrait, then Felix); the device's remembered character is read again with them on offer (one that is gone: the default).
  useEffect(() => { // MY-COMPANIONS
    if (!enabled || !STUDIO_MY_COMPANIONS_ENABLED) return // MY-COMPANIONS
    let cancelled = false // MY-COMPANIONS
    const get = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null // MY-COMPANIONS: the page's own fetch, handed to the lib (the requests are the lib's)
    void reachableCompanions(get).then(found => { // MY-COMPANIONS
      if (cancelled) return // MY-COMPANIONS
      setMine(found.length ? found : NO_COMPANIONS) // MY-COMPANIONS
      setCompanion(readCompanionChoice(deviceStorage(), STUDIO_VOICE_COMPANION, found.map(entry => entry.id))) // MY-COMPANIONS
    }) // MY-COMPANIONS
    return () => { cancelled = true } // MY-COMPANIONS
  }, [enabled]) // MY-COMPANIONS

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
        snapshot, pack: companion, choices, names, getLevel: controller.getLevel, // MY-COMPANIONS: the cast and the owner's own (the flag off: CHOICES and no names, as before)
        onChooseCompanion: () => { const next = nextCompanion(companion, choices); writeCompanionChoice(deviceStorage(), next, STUDIO_VOICE_COMPANION); rememberMyCompanion(deviceStorage(), COMPANION_STORAGE_KEY, next, mine); setCompanion(next) }, // MY-COMPANIONS: round the cast and the owner's own; the cast's write refuses a user pack, which is remembered by its own
        onTalkPress: () => controller.talkPress(), onTalkRelease: () => controller.talkRelease(), onStop: () => controller.stop(), onMute: muted => controller.setMuted(muted), onEnd: () => controller.endCall(),
        onRetry: () => { void controller.startCall(controller.getSnapshot().mode) }, onDismissNotice: () => controller.dismissNotice(),
      })
      : null,
    composerProps: { active: snapshot.active || snapshot.starting, busy: snapshot.starting, disabled: false, onStart: mode => { void controller.startCall(mode) }, buttons: STUDIO_VOICE_CALL_BUTTONS },
  }
}
