"use client"

// CHAT CLEAN (NEXT_PUBLIC_STUDIO_CHAT_CLEAN, default off): what the Director chat draws under the flag, in PK's v3 design
// (streams/frontend1/chat-design/v3, composer per v3.1). Presentation only: every decision is lib/studio-chat-clean.ts (pure); the
// page owns the state and the sends (stop / resume through sendBuildControl, new directions through the flow hook). Nothing here
// is mounted with the flag off: MessageList, ChatInput and the Builder page reach these through props that travel in one spread each.
//   StudioChatCleanJob      the thread's tail: the notes (stopped / resumed / applied, the user's directions) and the inline job card,
//                           or Director's one muted status line when no build narration is active
//   StudioChatCleanBar      the slim bar above the composer while a build is held: "Stopped at slide 5 · slides 1–4 kept" + Continue
//   StudioChatCleanSendSide the model picker (FRONTEND-2's slider variant: its own gauge button and slider popover) and the square Stop button beside Send;
//                           the research toggle chips of the v3 study stay behind CHAT_CLEAN_CHOICES.research ('menu' in v3.1: the
//                           composer's own research options button, moved next to Send by the stylesheet, holds the three switches)
//   useStudioChatCleanNotes the notes, kept per session by the page
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Brush, Check, Clock, Compass, Globe, ListOrdered, Pause, Play, Search, Square } from 'lucide-react'
import { ModelPicker } from '@/components/model-choice/model-picker'
import {
  CHAT_CLEAN_CHOICES,
  CHAT_CLEAN_WORDS,
  chatCleanDirectionsNote,
  chatCleanElapsed,
  chatCleanJobModel,
  chatCleanNotesReduce,
  chatCleanStatusLine,
  type ChatCleanComposerState,
  type ChatCleanJobIcon,
  type ChatCleanNarrationSnapshot,
  type ChatCleanNote,
  type ChatCleanThreadProps,
} from '@/lib/studio-chat-clean'

// ---------------------------------------------------------------------------------------------------------------------
// The notes, kept by the page (one hook call, inert with the flag off)
// ---------------------------------------------------------------------------------------------------------------------

export interface UseStudioChatCleanNotesInput {
  enabled: boolean
  sessionKey: string | null | undefined
  narration: ChatCleanNarrationSnapshot
  amend: { key: string | null; line: string }
}

export interface StudioChatCleanNotesApi {
  notes: readonly ChatCleanNote[]
  /** The user's new directions went to Director as instructions (never a chat message): keep them in the thread. */
  addDirections: (text: string) => void
}

const NO_NOTES: readonly ChatCleanNote[] = Object.freeze([])

export function useStudioChatCleanNotes(input: UseStudioChatCleanNotesInput): StudioChatCleanNotesApi {
  const [notes, setNotes] = useState<readonly ChatCleanNote[]>(NO_NOTES)
  const previousRef = useRef<ChatCleanNarrationSnapshot | null>(null)
  const latestRef = useRef(input)
  latestRef.current = input
  const { enabled, sessionKey } = input
  const { active, buildId, phase, control, slidesDone, slideCount } = input.narration
  const amendKey = input.amend.key, amendLine = input.amend.line

  useEffect(() => {
    if (!enabled) return
    previousRef.current = null
    setNotes(NO_NOTES)
  }, [enabled, sessionKey])

  useEffect(() => {
    if (!enabled) return
    const next: ChatCleanNarrationSnapshot = { active, buildId, phase, control, slidesDone, slideCount }
    const previous = previousRef.current
    previousRef.current = next
    setNotes(current => chatCleanNotesReduce(current, previous, next, Date.now(), { key: amendKey, line: amendLine }))
  }, [enabled, active, buildId, phase, control, slidesDone, slideCount, amendKey, amendLine])

  const addDirections = useCallback((text: string) => {
    if (!latestRef.current.enabled) return
    const id = latestRef.current.narration.buildId
    setNotes(current => chatCleanDirectionsNote(current, text, id, Date.now()))
  }, [])

  return { notes: enabled ? notes : NO_NOTES, addDirections }
}

// ---------------------------------------------------------------------------------------------------------------------
// The thread's tail: notes + the job card (or Director's status line)
// ---------------------------------------------------------------------------------------------------------------------

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}

function JobIcon({ icon }: { icon: ChatCleanJobIcon }) {
  const props = { size: 13, 'aria-hidden': true as const }
  switch (icon) {
    case 'stop': return <Square {...props} fill="currentColor" />
    case 'pause': return <Pause {...props} fill="currentColor" />
    case 'clock': return <Clock {...props} />
    case 'check': return <Check {...props} />
    case 'alert': return <AlertCircle {...props} />
    case 'compass': return <Compass {...props} />
    case 'list': return <ListOrdered {...props} />
    default: return <Brush {...props} />
  }
}

function NoteGlyph({ kind }: { kind: ChatCleanNote['kind'] }) {
  if (kind === 'stopped') return <Square size={11} fill="currentColor" aria-hidden="true" />
  if (kind === 'paused') return <Pause size={11} fill="currentColor" aria-hidden="true" />
  if (kind === 'not_applied') return <AlertCircle size={11} aria-hidden="true" />
  return <Play size={11} aria-hidden="true" />
}

export interface StudioChatCleanJobProps extends ChatCleanThreadProps {
  currentStatus?: { status?: string; text?: string } | null
}

/** The notes and the job card at the end of the thread. While the build is held the newest stop note stays out: the slim bar above the composer carries it. */
export function StudioChatCleanJob({ narration, notes, composer, currentStatus }: StudioChatCleanJobProps) {
  const latest = narration.deckEvents.length ? narration.deckEvents[narration.deckEvents.length - 1] : null
  const model = chatCleanJobModel({
    phase: narration.phase, control: narration.control, phaseLabel: narration.phaseLabel, slidesDone: narration.slidesDone, slideCount: narration.slideCount,
    latestEventText: latest?.text ?? null, latestEventStatus: latest?.status ?? null,
  })
  const now = useNow(narration.active && !model.clockFrozen)
  const elapsed = narration.active ? chatCleanElapsed(narration.startedAt, now) : null
  const held = composer.mode === 'held' || composer.mode === 'resuming'
  const shown = held && notes.length && (notes[notes.length - 1].kind === 'stopped' || notes[notes.length - 1].kind === 'paused') ? notes.slice(0, -1) : notes
  const status = chatCleanStatusLine(narration.active, currentStatus)
  return (
    <>
      {shown.length > 0 && (
        <div data-studio-chat-clean-notes="true">
          {shown.map(note => note.kind === 'directions'
            ? <div key={note.id} data-studio-chat-clean-directions="true"><p>{note.text}</p></div>
            : <p key={note.id} data-studio-chat-clean-note={note.kind}><NoteGlyph kind={note.kind} />{note.text}</p>)}
        </div>
      )}
      {narration.active ? (
        <section data-studio-chat-clean-job={model.halted ? 'held' : narration.phase} aria-label={model.title} role="status" aria-live="polite">
          <div data-studio-chat-clean-job-part="head">
            <h3><JobIcon icon={model.icon} />{model.title}</h3>
            <span data-studio-chat-clean-job-part="meta">{[model.tally, elapsed].filter(Boolean).join(' · ')}</span>
          </div>
          <div data-studio-chat-clean-job-part="steps" aria-hidden="true">
            {model.segments.map(segment => (
              <span key={segment.label} data-studio-chat-clean-step={segment.state} style={{ '--scc-fill': `${Math.round(segment.fill * 100)}%` } as React.CSSProperties}>{segment.label}</span>
            ))}
          </div>
          <p data-studio-chat-clean-job-part="line">{model.line}</p>
        </section>
      ) : status ? (
        <p data-studio-chat-clean-status="true" role="status" aria-live="polite"><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />{status}</p>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// The slim bar above the composer while the build is held
// ---------------------------------------------------------------------------------------------------------------------

export function StudioChatCleanBar({ composer, onContinue }: { composer: ChatCleanComposerState; onContinue: () => void }) {
  if (!composer.barText) return null
  return (
    <div data-studio-chat-clean-bar={composer.mode} role="status" aria-live="polite">
      {composer.mode === 'rebuilding' ? <Play size={11} aria-hidden="true" /> : <Square size={11} fill="currentColor" aria-hidden="true" />}
      <span><b>{composer.barText}</b>{composer.barDetail ? <> · {composer.barDetail}</> : null}</span>
      {composer.showContinue && (
        <button type="button" onClick={onContinue} disabled={!composer.continueEnabled} data-studio-chat-clean-continue="true">
          <Play size={11} aria-hidden="true" />{CHAT_CLEAN_WORDS.continueLabel}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// The composer's send side: the research chips (v3 study only), the model button, Stop
// ---------------------------------------------------------------------------------------------------------------------

export interface ChatCleanResearchProps {
  deep: boolean
  onDeep: (enabled: boolean) => void
  web: boolean
  onWeb: (enabled: boolean) => void
  /** Research settings are spent at strawman generation; after that they are frozen for the deck. */
  locked: boolean
}

export interface StudioChatCleanSendSideProps {
  composer: ChatCleanComposerState
  onStop: () => void
  research: ChatCleanResearchProps
  picker: { sessionId: string | null; disabled: boolean }
}

/** The model picker (FRONTEND-2's slider variant, as it ships: a gauge button opening the slider) and Stop while a build runs. With CHAT_CLEAN_CHOICES.research = 'chips' (the v3 study), "Web search" and "Deep research" toggle chips stand before them. */
export function StudioChatCleanSendSide({ composer, onStop, research, picker }: StudioChatCleanSendSideProps) {
  const chips = CHAT_CLEAN_CHOICES.research === 'chips'
  return (
    <>
      {chips && (
        <button type="button" aria-pressed={research.web} disabled={research.locked} onClick={() => research.onWeb(!research.web)} data-studio-chat-clean-toggle="web"
          title={research.locked ? CHAT_CLEAN_WORDS.lockedNote : undefined}>
          <Globe size={11} aria-hidden="true" />{CHAT_CLEAN_WORDS.webSearchItem}
        </button>
      )}
      {chips && (
        <button type="button" aria-pressed={research.deep} disabled={research.locked} onClick={() => research.onDeep(!research.deep)} data-studio-chat-clean-toggle="deep"
          title={research.locked ? CHAT_CLEAN_WORDS.lockedNote : CHAT_CLEAN_WORDS.deepResearchNote}>
          <Search size={11} aria-hidden="true" />{CHAT_CLEAN_WORDS.deepResearchItem}
        </button>
      )}
      <ModelPicker variant="slider" sessionId={picker.sessionId} disabled={picker.disabled} className="studio-chat-clean-model" />
      {composer.showStop && (
        <button type="button" onClick={onStop} disabled={!composer.stopEnabled} aria-label={CHAT_CLEAN_WORDS.stopLabel} title={CHAT_CLEAN_WORDS.stopLabel} data-studio-chat-clean-stop="true">
          <Square size={12} fill="currentColor" aria-hidden="true" />
        </button>
      )}
    </>
  )
}
