"use client"

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { DECK_IMPORT_NOTE_WORDS, deckImportNoteVisible, dismissDeckImportNote } from '@/lib/studio-deck-import'
import './studio-deck-import.css'

/**
 * STUDIO DECK IMPORT, contract section 3 (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, default off; the Builder page mounts it, loaded lazily, only with the flag on and the Studio shell).
 * One small note in the Builder's chat column for an imported deck: "This deck keeps the design of your PowerPoint file. Changing the theme and Add Element are not available for imported
 * decks yet." The Builder itself refuses both on such a deck (its own words are untouched); this says why in the person's terms before they try. `adopted` is the page's reading of
 * Director's marker (`composer_adoption.source === "deck_import"`, sent on every connect, so any device has it); this browser's own record of the sessions it imported is the fallback.
 * It reads this browser's storage only: no request, no socket, nothing written except the person's "Got it".
 */
export function StudioDeckImportNote({ sessionId, adopted = false, className = '' }: { sessionId?: string | null; adopted?: boolean; className?: string }) {
  const { user } = useAuth()
  const userId = user?.id || user?.email || undefined
  const [shownFor, setShownFor] = useState<string | null>(null)
  useEffect(() => {
    let visible = false
    try { visible = deckImportNoteVisible(window.localStorage, userId, sessionId, adopted) } catch { /* no localStorage: only Director's marker, below */ visible = adopted && !!userId && !!sessionId }
    setShownFor(visible && sessionId ? sessionId : null)
  }, [userId, sessionId, adopted])
  if (!userId || !sessionId || shownFor !== sessionId) return null
  return (
    <aside data-studio-deck-import-note="true" role="note" aria-label={DECK_IMPORT_NOTE_WORDS.title} className={className}>
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
