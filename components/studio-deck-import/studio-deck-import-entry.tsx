"use client"

import { useState } from 'react'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StudioDeckImportDialog } from './studio-deck-import-dialog'
import './studio-deck-import.css'

/**
 * STUDIO DECK IMPORT (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, default off): the "Import a PowerPoint" button above the Decks page (drawn by app/(app)/dashboard/layout.tsx, which draws nothing
 * and adds no wrapper with the flag off). The dialog is mounted only while it is open, so with the page at rest nothing runs.
 */
export function StudioDeckImportEntry() {
  const [open, setOpen] = useState(false)
  return (
    <div data-studio-deck-import-bar="true">
      <Button data-studio-deck-import-open="true" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp className="mr-2 h-4 w-4" /> Import a PowerPoint
      </Button>
      {open && <StudioDeckImportDialog open={open} onOpenChange={setOpen} />}
    </div>
  )
}
