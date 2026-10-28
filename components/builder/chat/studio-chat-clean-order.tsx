"use client"

// CLEAN CHAT ORDER (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER, default off; lib/studio-chat-clean-order.ts decides everything). Two pieces, mounted by MessageList only with the flag on:
//   StudioChatCleanNotesAt    the thread's notes (stopped / paused / resumed / applied, the user's directions) drawn BETWEEN the transcript rows, where they happened: the same markup StudioChatCleanJob draws at the tail
//   StudioChatCleanOrderTail  the thread's tail: StudioChatCleanJob, with the stale working line closed (the newest deck event is the card's line only inside the stretch of work it belongs to)
import React, { useEffect, useRef } from 'react'
import { AlertCircle, Pause, Play, Square } from 'lucide-react'
import { StudioChatCleanJob, type StudioChatCleanJobProps } from '@/components/builder/chat/studio-chat-clean'
import { chatCleanLineStep, chatCleanLineVisible, type ChatCleanLineState } from '@/lib/studio-chat-clean-order'
import type { ChatCleanNote } from '@/lib/studio-chat-clean'

function NoteGlyph({ kind }: { kind: ChatCleanNote['kind'] }) {
  if (kind === 'stopped') return <Square size={11} fill="currentColor" aria-hidden="true" />
  if (kind === 'paused') return <Pause size={11} fill="currentColor" aria-hidden="true" />
  if (kind === 'not_applied') return <AlertCircle size={11} aria-hidden="true" />
  return <Play size={11} aria-hidden="true" />
}

/** Notes at one place in the thread: exactly the markup of the notes StudioChatCleanJob draws at the end. */
export function StudioChatCleanNotesAt({ notes }: { notes: readonly ChatCleanNote[] }) {
  if (notes.length === 0) return null
  return (
    <div data-studio-chat-clean-notes="true">
      {notes.map(note => note.kind === 'directions'
        ? <div key={note.id} data-studio-chat-clean-directions="true"><p>{note.text}</p></div>
        : <p key={note.id} data-studio-chat-clean-note={note.kind}><NoteGlyph kind={note.kind} />{note.text}</p>)}
    </div>
  )
}

export interface StudioChatCleanOrderTailProps extends StudioChatCleanJobProps {
  /** The id of the newest approval card / ask in the transcript (chatCleanLastGateId), or null. */
  gate: string | null
}

type NarrationWithEvents = StudioChatCleanJobProps['narration'] & { ghosts?: unknown; deckEvents: ReadonlyArray<{ id?: string; text: string; status: string }> }

/**
 * The thread's tail with the working line kept honest. The card shows the newest deck event as its one line; this wrapper hands it the narration without that event when the event belongs to work that has ended
 * (the phase, the build, the outline or the newest approval card changed since it was the newest) or when the build waits at the outline gate. The card then uses its own words (the phase's label). The step is pure
 * (chatCleanLineStep); the last step is kept in a ref and committed in an effect, so a render that is thrown away leaves nothing behind.
 */
export function StudioChatCleanOrderTail({ gate, narration, ...rest }: StudioChatCleanOrderTailProps) {
  const full = narration as NarrationWithEvents
  const latest = full.deckEvents.length ? full.deckEvents[full.deckEvents.length - 1] : null
  const previous = useRef<ChatCleanLineState | null>(null)
  const state = chatCleanLineStep(previous.current, { phase: full.phase, buildId: full.buildId, ghosts: full.ghosts ?? null, gate, latestId: latest ? (latest.id ?? latest.text) : null })
  useEffect(() => { previous.current = state })
  return <StudioChatCleanJob {...rest} narration={chatCleanLineVisible(state) ? narration : { ...narration, deckEvents: [] }} />
}
