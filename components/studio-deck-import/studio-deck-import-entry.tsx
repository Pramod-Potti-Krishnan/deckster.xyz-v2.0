"use client"

import { useEffect, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deckImportEntryCleanUrl, deckImportRequested } from '@/lib/studio-deck-import'
import { StudioDeckImportDialog } from './studio-deck-import-dialog'
import './studio-deck-import.css'

/**
 * STUDIO DECK IMPORT (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, default off): the "Import a PowerPoint" button above the Decks page (drawn by app/(app)/dashboard/layout.tsx, which draws nothing
 * and adds no wrapper with the flag off). The dialog is mounted only while it is open, so with the page at rest nothing runs. The Builder's welcome links to /dashboard?import=pptx
 * (ruling I5a, two links in the first-run actions and on the welcome stage): arriving with that query opens the dialog once and takes the query out of the address, so a reload does not.
 */
export function StudioDeckImportEntry() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!deckImportRequested(window.location.search)) return
    setOpen(true)
    try { window.history.replaceState(window.history.state, '', deckImportEntryCleanUrl(window.location)) } catch { /* the address keeps the query; the dialog is open all the same */ }
  }, [])
  return (
    <div data-studio-deck-import-bar="true">
      <Button data-studio-deck-import-open="true" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp className="mr-2 h-4 w-4" /> Import a PowerPoint
      </Button>
      {open && <StudioDeckImportDialog open={open} onOpenChange={setOpen} />}
    </div>
  )
}
