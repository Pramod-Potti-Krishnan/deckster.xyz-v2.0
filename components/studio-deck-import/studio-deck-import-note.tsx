"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Info } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { DECK_IMPORT_NOTE_WORDS, deckImportNoteVisible, dismissDeckImportNote } from '@/lib/studio-deck-import'
import './studio-deck-import.css'

/**
 * STUDIO DECK IMPORT, contract section 3 (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, default off; drawn by app/builder/layout.tsx, which draws nothing with the flag off or outside the Studio shell).
 * One small note over the Builder for a deck THIS browser imported (lib/studio-deck-import.ts remembers the session ids): "This deck keeps the design of your PowerPoint file. Changing the theme and
 * Add Element are not available for imported decks yet." The Builder itself refuses both on such a deck (its own words, "This template keeps its stored source theme.", are untouched); this
 * says why in the person's terms before they try. It reads the address and this browser's storage only: no request, no socket, nothing written except the person's "Got it".
 */
export function StudioDeckImportNote() {
  const { user } = useAuth()
  const userId = user?.id || user?.email || undefined
  const sessionId = useSearchParams()?.get('session_id') ?? null
  const [shownFor, setShownFor] = useState<string | null>(null)
  useEffect(() => {
    let visible = false
    try { visible = deckImportNoteVisible(window.localStorage, userId, sessionId) } catch { /* no localStorage: no note */ }
    setShownFor(visible ? sessionId : null)
  }, [userId, sessionId])
  if (!userId || !sessionId || shownFor !== sessionId) return null
  return (
    <aside data-studio-deck-import-note="true" role="note" aria-label={DECK_IMPORT_NOTE_WORDS.title}>
      <Info size={15} aria-hidden="true" />
      <div>
        <strong>{DECK_IMPORT_NOTE_WORDS.title}</strong>
        <p>{DECK_IMPORT_NOTE_WORDS.body}</p>
      </div>
      <button type="button" data-studio-deck-import-note-dismiss="true" onClick={() => {
        try { dismissDeckImportNote(window.localStorage, userId, sessionId) } catch { /* the note comes back next time */ }
        setShownFor(null)
      }}>{DECK_IMPORT_NOTE_WORDS.dismiss}</button>
    </aside>
  )
}
