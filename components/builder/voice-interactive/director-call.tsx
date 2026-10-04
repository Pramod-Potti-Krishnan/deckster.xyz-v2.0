"use client"

import type { KeyboardEvent } from "react"
import { HelpCircle, Keyboard, Mic, MicOff, PhoneCall, PhoneOff, Rows3, UserRound, Volume2, VolumeX } from "lucide-react"
import { formatCallDuration } from "@/lib/studio-voice-interactive"
import { DirectorCharacter, type DirectorCharacterState } from "./director-character"
import type { DirectorCallState } from "./use-director-call"
import "./director-call.css"

const MODE_LABEL = { voice: "Voice call", interactive: "Interactive call" } as const

/** Entry actions and live timer, rendered inside the existing Director header. */
export function DirectorCallEntry({ call, disabled }: { call: DirectorCallState; disabled?: boolean }) {
  if (call.mode !== "chat") {
    return (
      <span data-director-call-pill="true">
        <span aria-hidden="true" />
        {MODE_LABEL[call.mode]} · <span>{formatCallDuration(call.elapsedSeconds)}</span>
      </span>
    )
  }
  return (
    <span data-director-call-entry="true">
      <button type="button" disabled={disabled} onClick={() => call.start("voice")} aria-label="Start voice call with the Director" title="Voice call">
        <PhoneCall size={13} aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onClick={() => call.start("interactive")} aria-label="Open interactive Director" title="Interactive Director">
        <UserRound size={13} aria-hidden="true" />
      </button>
    </span>
  )
}

export interface DirectorCallPanelProps {
  call: DirectorCallState
  /** Director has the turn: a sent message is awaiting its reply. */
  awaitingReply: boolean
  /** Slides are being generated. */
  building: boolean
  latestDirectorText: string | null
  latestUserText: string | null
  /** Newest unanswered Director question; answered only through its real card. */
  pendingAsk?: { id: string; prompt: string } | null
  focusComposer: () => void
}

/** Bring the real question card into view and focus its first control. */
function goToAsk(): boolean {
  const cards = document.querySelectorAll<HTMLElement>("[data-studio-director-ask]")
  const card = cards[cards.length - 1]
  if (!card) return false
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  card.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" })
  card.querySelector<HTMLElement>("button:not([disabled]), textarea:not([disabled]), input:not([disabled])")?.focus({ preventScroll: true })
  return true
}

function characterState(call: DirectorCallState, awaitingReply: boolean, building: boolean): DirectorCharacterState {
  if (call.speaking) return "speaking"
  if (awaitingReply) return "thinking"
  if (building) return "noting"
  return "idle"
}

const STATUS: Record<DirectorCharacterState, { title: string; detail: string }> = {
  speaking: { title: "Reading the reply aloud", detail: "On-device voice · full reply in the chat" },
  thinking: { title: "Director is replying", detail: "Your message was sent through the chat" },
  noting: { title: "Working on your slides", detail: "Progress appears in the chat below" },
  idle: { title: "Ready when you are", detail: "Type in the composer; turns stay in this chat" },
  listening: { title: "Listening", detail: "" },
}

/** Voice strip or interactive stage. Messages, questions and the composer stay the Builder's own. */
export function DirectorCallPanel({ call, awaitingReply, building, latestDirectorText, latestUserText, pendingAsk, focusComposer }: DirectorCallPanelProps) {
  if (call.mode === "chat") return null
  const state = characterState(call, awaitingReply, building)
  const status = STATUS[state]
  const interactive = call.mode === "interactive"
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.stopPropagation(); focusComposer() }
  }

  const controls = (
    <div data-director-call-controls="true" role="toolbar" aria-label="Call controls">
      <button type="button" disabled aria-disabled="true" aria-label="Voice input unavailable" title={call.input.reason} data-capability="unavailable">
        {call.input.available ? <Mic size={14} aria-hidden="true" /> : <MicOff size={14} aria-hidden="true" />}
      </button>
      <button
        type="button"
        aria-pressed={call.outputOn}
        disabled={!call.output.available}
        onClick={() => call.setOutputOn(!call.outputOn)}
        aria-label={call.outputOn ? "Stop reading replies aloud" : "Read replies aloud"}
        title={call.output.reason}
      >
        {call.outputOn ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={() => call.switchMode(interactive ? "voice" : "interactive")}
        aria-label={interactive ? "Switch to voice strip" : "Switch to interactive Director"}
        title={interactive ? "Voice strip" : "Interactive Director"}
      >
        {interactive ? <Rows3 size={14} aria-hidden="true" /> : <UserRound size={14} aria-hidden="true" />}
      </button>
      <p>{call.input.available ? "Speak or type" : "Typed turns · voice input off"}</p>
      <button type="button" data-director-call-end="true" onClick={call.end} aria-label="End call">
        <PhoneOff size={15} aria-hidden="true" />
      </button>
    </div>
  )

  const ask = pendingAsk ? (
    <div data-director-call-ask="true" role="group" aria-label="Director asks">
      <HelpCircle size={13} aria-hidden="true" />
      <p><strong>Director asks</strong>{pendingAsk.prompt}</p>
      <button type="button" onClick={() => { if (!goToAsk()) focusComposer() }}>Answer in chat</button>
    </div>
  ) : null

  const statusLine = (
    <div data-director-call-status="true">
      <strong>{status.title}</strong>
      <span>{status.detail}</span>
    </div>
  )

  if (!interactive) {
    return (
      <section data-director-call="voice" aria-label="Director voice call" onKeyDown={onKeyDown}>
        {controls}
        <div data-director-call-strip="true">
          <div data-director-call-portrait="true"><DirectorCharacter state={state} portrait withBackground={false} /></div>
          <div role="status" aria-live="polite" aria-atomic="true">{statusLine}</div>
          {call.speaking && (
            <button type="button" onClick={call.stopSpeaking} data-director-call-interrupt="true">Stop speaking</button>
          )}
        </div>
        <p data-director-call-note="true">{call.output.reason} {call.input.reason}</p>
        {ask}
      </section>
    )
  }

  return (
    <section data-director-call="interactive" aria-label="Interactive Director" onKeyDown={onKeyDown}>
      {controls}
      <div data-director-call-stage="true">
        <DirectorCharacter state={state} withBackground={false} />
        <div data-director-call-self="true" aria-label="You, camera not used">
          <UserRound size={14} aria-hidden="true" /><span>Camera not used</span>
        </div>
        <div data-director-call-stage-status="true" role="status" aria-live="polite" aria-atomic="true">{statusLine}</div>
      </div>
      {ask}
      <div data-director-call-captions="true" aria-label="Latest turns">
        <p><span>You</span>{latestUserText ?? <em>No message yet</em>}</p>
        <p><span>Director</span>{latestDirectorText ?? <em>No reply yet</em>}</p>
      </div>
      <div data-director-call-talk="true">
        <button type="button" onClick={focusComposer} data-director-call-type="true">
          <Keyboard size={14} aria-hidden="true" /> Type to the Director
        </button>
        {call.speaking && <button type="button" onClick={call.stopSpeaking}>Stop speaking</button>}
        <p>Questions and choices stay in the chat below, with their own buttons.</p>
      </div>
    </section>
  )
}
