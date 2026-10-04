"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  clipForSpeech,
  latestDirectorReply,
  pickLocalVoice,
  speechInputStatus,
  speechOutputStatus,
  type CapabilityStatus,
  type DirectorCallMode,
} from "@/lib/studio-voice-interactive"

interface MessageLike { message_id?: string; type?: string; payload?: unknown }

export interface UseDirectorCallOptions {
  /** Build-time feature flag. When false the hook starts no timer, listener or speech. */
  enabled: boolean
  messages: readonly MessageLike[]
  /**
   * Account, session and deck identity. A part changing from a known value to
   * anything else (switch or loss) ends the call; a first assignment (a new
   * session or deck created during the call) does not.
   */
  scope: readonly (string | null | undefined)[]
  /** Called after End so chat focus is restored to the real composer. */
  focusComposer?: () => void
}

export interface DirectorCallState {
  mode: DirectorCallMode
  elapsedSeconds: number
  input: CapabilityStatus
  output: CapabilityStatus
  /** The user explicitly turned spoken replies on. */
  outputOn: boolean
  /** On-device speech is currently playing. */
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

/**
 * Call state for the Director voice / interactive channel. It never owns the
 * socket, session or send path: those stay in the Builder. Media is limited to
 * opt-in on-device speech output; voice input is reported unavailable.
 */
export function useDirectorCall({ enabled, messages, scope, focusComposer }: UseDirectorCallOptions): DirectorCallState {
  const [mode, setMode] = useState<DirectorCallMode>("chat")
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [outputOn, setOutputOnState] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [input, setInput] = useState<CapabilityStatus>(UNCHECKED)
  const [output, setOutput] = useState<CapabilityStatus>(UNCHECKED)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const spokenIdRef = useRef<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const focusRef = useRef(focusComposer)
  focusRef.current = focusComposer
  const inCall = enabled && mode !== "chat"

  const stopSpeaking = useCallback(() => {
    const u = utteranceRef.current
    utteranceRef.current = null
    if (u) { u.onend = null; u.onerror = null }
    synth()?.cancel()
    setSpeaking(false)
  }, [])

  const stop = useCallback((restoreFocus: boolean) => {
    // A scope-change end only moves focus if it was inside the call that is closing.
    const focusInCall = typeof document !== "undefined" && !!document.activeElement?.closest?.("[data-director-call]")
    stopSpeaking()
    setOutputOnState(false)
    setMode("chat")
    setStartedAt(null)
    spokenIdRef.current = null
    if (restoreFocus || focusInCall) requestAnimationFrame(() => focusRef.current?.())
  }, [stopSpeaking])
  /** User End: stop media and return focus to the composer. */
  const end = useCallback(() => stop(true), [stop])

  const start = useCallback((next: Exclude<DirectorCallMode, "chat">) => {
    if (!enabled) return
    setMode(next)
    setStartedAt(prev => prev ?? Date.now())
    setNow(Date.now())
  }, [enabled])

  const switchMode = useCallback((next: Exclude<DirectorCallMode, "chat">) => {
    if (!enabled) return
    setMode(prev => (prev === "chat" ? prev : next))
  }, [enabled])

  const setOutputOn = useCallback((on: boolean) => {
    if (!on) { stopSpeaking(); setOutputOnState(false); return }
    if (!voiceRef.current) return
    // Only replies that arrive after the user opts in are spoken.
    spokenIdRef.current = latestDirectorReply(messagesRef.current)?.id ?? null
    setOutputOnState(true)
  }, [stopSpeaking])

  // Detect capabilities only once a call is open: nothing runs while the flag is off.
  useEffect(() => {
    if (!inCall) return
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setInput(speechInputStatus(w))
    const s = synth()
    const refresh = () => {
      const voice = s ? pickLocalVoice(s.getVoices(), navigator.language || "en") : null
      voiceRef.current = voice
      setOutput(speechOutputStatus(!!s, voice))
    }
    refresh()
    s?.addEventListener?.("voiceschanged", refresh)
    return () => s?.removeEventListener?.("voiceschanged", refresh)
  }, [inCall])

  // Call timer.
  useEffect(() => {
    if (!inCall) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [inCall])

  // Speak each new Director reply, newest wins (no overlap).
  useEffect(() => {
    if (!inCall || !outputOn) return
    const s = synth()
    const voice = voiceRef.current
    const reply = latestDirectorReply(messages)
    if (!s || !voice || !reply || reply.id === spokenIdRef.current) return
    spokenIdRef.current = reply.id
    stopSpeaking()
    const u = new SpeechSynthesisUtterance(clipForSpeech(reply.text))
    u.voice = voice
    u.lang = voice.lang
    u.onend = () => { if (utteranceRef.current === u) { utteranceRef.current = null; setSpeaking(false) } }
    u.onerror = u.onend
    utteranceRef.current = u
    setSpeaking(true)
    s.speak(u)
  }, [inCall, outputOn, messages, stopSpeaking])

  // Scope change (account, session, deck, eligibility) ends the call.
  const scopeKey = JSON.stringify(scope.map(part => part ?? null))
  const scopeRef = useRef<(string | null)[]>(JSON.parse(scopeKey))
  useEffect(() => {
    const next: (string | null)[] = JSON.parse(scopeKey)
    const prev = scopeRef.current
    scopeRef.current = next
    const switched = next.some((part, i) => prev[i] != null && prev[i] !== part)
    if (switched && mode !== "chat") stop(false)
  }, [scopeKey, mode, stop])

  // Hidden tab / page hide stops output; unmount stops everything.
  useEffect(() => {
    if (!inCall) return
    const onHidden = () => {
      if (document.visibilityState === "hidden") { stopSpeaking(); setOutputOnState(false) }
    }
    const onPageHide = () => { stopSpeaking(); setOutputOnState(false) }
    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [inCall, stopSpeaking])

  useEffect(() => () => {
    if (utteranceRef.current) synth()?.cancel()
  }, [])

  return {
    mode: enabled ? mode : "chat",
    elapsedSeconds: startedAt ? Math.max(0, (now - startedAt) / 1000) : 0,
    input,
    output,
    outputOn,
    speaking,
    start,
    switchMode,
    end,
    setOutputOn,
    stopSpeaking,
  }
}
