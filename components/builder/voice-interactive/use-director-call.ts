"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  clipForSpeech, latestDirectorReply, pickLocalVoice, speechInputStatus, speechOutputStatus,
  type CapabilityStatus, type DirectorCallMode, type DirectorCallMessage, type DirectorReplyPolicy,
} from "@/lib/studio-voice-interactive"

export interface UseDirectorCallOptions {
  /** Both literal build flags are required by the existing centralized flag. */
  enabled: boolean
  messages: readonly DirectorCallMessage[]
  /** Existing authenticated/displayed-session/navigation/effective-deck epoch.
   * The caller retires it on intent, including A→B→A before data is loaded. */
  owner: object | null
  /** Render-current eligibility: authenticated, owned and not restoring/loading. */
  eligible: boolean
  /** Interaction-time validation against the caller's current authoritative refs. */
  isCurrentOwner: (owner: object) => boolean
  /** Known scope changes retire; null→first assignment preserves only within
   * the same positively owned epoch. Counts/replies/refreshes are not scope. */
  scope: readonly (string | null | undefined)[]
  replyPolicy: DirectorReplyPolicy | null
  focusComposer?: () => void
}

export interface DirectorCallState {
  mode: DirectorCallMode
  elapsedSeconds: number
  input: CapabilityStatus
  output: CapabilityStatus
  outputOn: boolean
  speaking: boolean
  start: (mode: Exclude<DirectorCallMode, "chat">) => void
  switchMode: (mode: Exclude<DirectorCallMode, "chat">) => void
  end: () => void
  setOutputOn: (on: boolean) => void
  stopSpeaking: () => void
}

const UNCHECKED: CapabilityStatus = { available: false, reason: "Checking this device…" }
function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null
}
function visible(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible"
}

/** Locally opted-in output only. This hook never owns a transport, answer, save
 * or generation Stop. Synchronous epoch/consent retirement precedes every
 * dispatch; the cleanup effect subsequently cancels old owned media. */
export function useDirectorCall({ enabled, messages, owner, eligible, isCurrentOwner, scope, replyPolicy, focusComposer }: UseDirectorCallOptions): DirectorCallState {
  const [mode, setMode] = useState<DirectorCallMode>("chat")
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [outputOn, setOutputOnState] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [input, setInput] = useState<CapabilityStatus>(UNCHECKED)
  const [output, setOutput] = useState<CapabilityStatus>(UNCHECKED)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const admittedEpochRef = useRef<object | null>(null)
  const outputConsentRef = useRef(false)
  const seenReplyIdsRef = useRef(new Set<string>())
  const mountedRef = useRef(true)
  const currentScopeRef = useRef({ owner, parts: scope.map(part => part ?? null), enabled, eligible, epoch: {} })
  const parts = scope.map(part => part ?? null)
  const previous = currentScopeRef.current
  const changed = previous.owner !== owner || previous.enabled !== enabled || previous.eligible !== eligible
    || previous.parts.length !== parts.length
    || parts.some((part, index) => previous.parts[index] !== null && previous.parts[index] !== part)
  if (changed) {
    currentScopeRef.current = { owner, parts, enabled, eligible, epoch: {} }
    // Revoke authority during render, before ANY passive effect or retained
    // callback can dispatch. Never perform a media API side effect in render.
    admittedEpochRef.current = null
    outputConsentRef.current = false
  } else {
    currentScopeRef.current.parts = parts
  }
  const epoch = currentScopeRef.current.epoch
  const ownerValidatorRef = useRef(isCurrentOwner)
  ownerValidatorRef.current = isCurrentOwner
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const policyRef = useRef(replyPolicy)
  policyRef.current = replyPolicy
  const focusRef = useRef(focusComposer)
  focusRef.current = focusComposer

  const isAdmitted = useCallback(() => {
    const current = currentScopeRef.current
    return mountedRef.current && current.epoch === epoch && admittedEpochRef.current === epoch
      && current.enabled && current.eligible && !!current.owner
      && typeof ownerValidatorRef.current === 'function' && ownerValidatorRef.current(current.owner)
  }, [epoch])
  const inCall = mode !== "chat" && isAdmitted()

  const cancelUtterance = useCallback(() => {
    const utterance = utteranceRef.current
    utteranceRef.current = null
    if (utterance) {
      utterance.onend = null
      utterance.onerror = null
      synth()?.cancel()
    }
    setSpeaking(false)
  }, [])
  const stop = useCallback((restoreFocus: boolean) => {
    const focusInCall = typeof document !== "undefined" && !!document.activeElement?.closest?.("[data-director-call]")
    admittedEpochRef.current = null
    outputConsentRef.current = false
    cancelUtterance()
    setOutputOnState(false)
    setMode("chat")
    setStartedAt(null)
    seenReplyIdsRef.current.clear()
    voiceRef.current = null
    if (restoreFocus || focusInCall) {
      const focusEpoch = currentScopeRef.current.epoch
      requestAnimationFrame(() => {
        const current = currentScopeRef.current
        if (mountedRef.current && current.epoch === focusEpoch && current.enabled && current.eligible
          && current.owner && ownerValidatorRef.current?.(current.owner)) focusRef.current?.()
      })
    }
  }, [cancelUtterance])
  const end = useCallback(() => { if (isAdmitted()) stop(true) }, [isAdmitted, stop])
  const stopSpeaking = useCallback(() => { if (isAdmitted()) cancelUtterance() }, [isAdmitted, cancelUtterance])
  const start = useCallback((next: Exclude<DirectorCallMode, "chat">) => {
    const current = currentScopeRef.current
    if (!mountedRef.current || current.epoch !== epoch || !current.enabled || !current.eligible
      || !current.owner || !ownerValidatorRef.current?.(current.owner) || !visible()) return
    admittedEpochRef.current = epoch
    outputConsentRef.current = false
    setOutputOnState(false)
    setMode(next)
    setStartedAt(prev => prev ?? Date.now())
    setNow(Date.now())
  }, [epoch])
  const switchMode = useCallback((next: Exclude<DirectorCallMode, "chat">) => {
    if (isAdmitted()) setMode(prev => prev === "chat" ? prev : next)
  }, [isAdmitted])
  const setOutputOn = useCallback((on: boolean) => {
    if (!isAdmitted()) return
    if (!on) {
      outputConsentRef.current = false
      cancelUtterance()
      setOutputOnState(false)
      return
    }
    if (!visible() || voiceRef.current?.localService !== true) return
    // Baseline all stable IDs, not just the current last reply. Restored,
    // reordered and superseded existing turns can never become "new" speech.
    seenReplyIdsRef.current = new Set(messagesRef.current.map(message => message.message_id).filter((id): id is string => !!id))
    outputConsentRef.current = true
    setOutputOnState(true)
  }, [isAdmitted, cancelUtterance])

  // Retire before the other effects. Their closures also independently check
  // the synchronous epoch, so ordering alone is never dispatch authority.
  useEffect(() => {
    if (mode !== "chat" && !isAdmitted()) stop(false)
  }, [epoch, mode, inCall, isAdmitted, stop])

  useEffect(() => {
    if (!inCall) return
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setInput(speechInputStatus(w))
    const synthesis = synth()
    const refresh = () => {
      if (!isAdmitted()) return
      const voice = synthesis ? pickLocalVoice(synthesis.getVoices(), navigator.language || "en") : null
      voiceRef.current = voice
      setOutput(speechOutputStatus(!!synthesis, voice))
      if (!voice) {
        outputConsentRef.current = false
        cancelUtterance()
        setOutputOnState(false)
      }
    }
    refresh()
    synthesis?.addEventListener?.("voiceschanged", refresh)
    return () => synthesis?.removeEventListener?.("voiceschanged", refresh)
  }, [inCall, isAdmitted, cancelUtterance])

  useEffect(() => {
    if (!inCall) return
    const id = window.setInterval(() => { if (isAdmitted()) setNow(Date.now()) }, 1000)
    return () => window.clearInterval(id)
  }, [inCall, isAdmitted])

  useEffect(() => {
    if (!inCall || !outputOn) return
    if (!isAdmitted() || !outputConsentRef.current || !visible()) return
    const policy = policyRef.current
    if (!policy || policy.owner !== currentScopeRef.current.owner) return
    const synthesis = synth()
    const voice = voiceRef.current
    const reply = latestDirectorReply(messages, policy)
    const alreadySeen = !reply || seenReplyIdsRef.current.has(reply.id)
    // Newest wins. Mark all current IDs so an older superseded reply cannot
    // become eligible after an array reorder/removal.
    for (const message of messages) if (message.message_id) seenReplyIdsRef.current.add(message.message_id)
    if (!synthesis || voice?.localService !== true || !reply || alreadySeen) return
    cancelUtterance()
    if (!isAdmitted() || !outputConsentRef.current || !visible()) return
    const utterance = new SpeechSynthesisUtterance(clipForSpeech(reply.text))
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.onend = () => {
      if (isAdmitted() && utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeaking(false)
      }
    }
    utterance.onerror = utterance.onend
    utteranceRef.current = utterance
    setSpeaking(true)
    if (isAdmitted() && outputConsentRef.current && visible()) synthesis.speak(utterance)
    else cancelUtterance()
  }, [inCall, outputOn, messages, replyPolicy, isAdmitted, cancelUtterance])

  useEffect(() => {
    if (!inCall) return
    const suspend = () => {
      if (currentScopeRef.current.epoch !== epoch) return
      outputConsentRef.current = false
      cancelUtterance()
      setOutputOnState(false)
    }
    const onHidden = () => { if (document.visibilityState === "hidden") suspend() }
    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("pagehide", suspend)
    return () => {
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("pagehide", suspend)
    }
  }, [inCall, epoch, cancelUtterance])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      admittedEpochRef.current = null
      outputConsentRef.current = false
      const utterance = utteranceRef.current
      utteranceRef.current = null
      if (utterance) { utterance.onend = null; utterance.onerror = null; synth()?.cancel() }
    }
  }, [])

  return {
    mode: inCall ? mode : "chat",
    elapsedSeconds: inCall && startedAt !== null ? Math.max(0, (now - startedAt) / 1000) : 0,
    input, output,
    outputOn: inCall && outputOn && outputConsentRef.current,
    speaking: inCall && speaking,
    start, switchMode, end, setOutputOn, stopSpeaking,
  }
}
