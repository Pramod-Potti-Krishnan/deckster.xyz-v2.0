"use client"

import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStudioDeckImport } from '@/hooks/use-studio-deck-import'
import './studio-deck-import.css'

// NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (default off): launched wording instead of promises and developer-speak; off, this file is exactly as before.
const LAUNCH_WORDING = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === 'true'

/**
 * STUDIO DECK IMPORT (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, default off; only the entry next to the Decks page draws this, and only with the flag on and the Studio shell).
 * One dialog, four states: choose a file; working (upload, start, then Director's own stage words, slides done and time left; a busy slot is "Waiting for a free slot…", not an error);
 * ready (what changed, then "Open deck"; with nothing to report the Builder opens on its own); failed (Director's words as they are, "Try again" only when Director says the failure can be retried).
 * It cannot be closed while it works. A PDF is accepted by the picker only to be told, in the contract's words, that PDF import is coming.
 */
export function StudioDeckImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const imp = useStudioDeckImport(open)
  const { phase, working, failure, summary } = imp

  return (
    <Dialog open={open} onOpenChange={next => {
      if (phase === 'working') return
      if (!next) imp.reset()
      onOpenChange(next)
    }}>
      <DialogContent data-studio-deck-import-dialog="true" className="sm:max-w-lg">
        <DialogHeader data-studio-deck-import-header="true">
          <DialogTitle>Import a PowerPoint deck</DialogTitle>
          <DialogDescription>Open a PowerPoint file you already have as an editable deck. It keeps the design of your file; every word stays editable text.</DialogDescription>
        </DialogHeader>
        <div data-studio-deck-import-body="true" tabIndex={0} role="region" aria-label="Import a PowerPoint deck">
          {phase === 'choose' && <div data-studio-deck-import-choose="true">
            <label htmlFor="studio-deck-import-file">PowerPoint file</label>
            <input id="studio-deck-import-file" type="file" accept=".pptx,.pdf"
              onChange={event => imp.choose(event.target.files?.[0] || null)} />
            <p data-studio-deck-import-hint="true">PowerPoint (.pptx), widescreen (16:9), up to 100 MB.</p>
            {imp.fileError && <p data-studio-deck-import-error="true" role="alert">{imp.fileError}</p>}
            <Button data-studio-deck-import-action="start" disabled={!imp.canStart} onClick={() => { void imp.begin() }}>
              <FileUp className="mr-2 h-4 w-4" /> Import deck
            </Button>
          </div>}
          {phase === 'working' && working && <div data-studio-deck-import-working="true" role="status" aria-live="polite" tabIndex={0} aria-label="Import status">
            <p data-studio-deck-import-words="true"><Loader2 className="h-4 w-4 animate-spin" /> {working.words}</p>
            {working.detail && <p data-studio-deck-import-detail="true">{working.detail}</p>}
            {working.progress && <div data-studio-deck-import-meter="true" role="progressbar" aria-label="Slides placed" aria-valuemin={0} aria-valuemax={working.progress.total} aria-valuenow={working.progress.done}>
              <span style={{ width: `${Math.round((working.progress.done / working.progress.total) * 100)}%` }} />
            </div>}
            {(working.progress || working.eta) && <p data-studio-deck-import-count="true">{[working.progress?.label, working.eta].filter(Boolean).join(' · ')}</p>}
            <p data-studio-deck-import-hint="true">Keep this window open. Your deck opens when it is ready.</p>
          </div>}
          {phase === 'ready' && summary && <div data-studio-deck-import-ready="true" role="status" aria-live="polite">
            <p data-studio-deck-import-words="true">{summary.banner || summary.notesLine ? 'Your deck is ready.' : 'Opening your deck…'}</p>
            {(summary.title || summary.slideCount !== null) && <p data-studio-deck-import-count="true">{[summary.title, summary.slideCount !== null ? `${summary.slideCount} ${summary.slideCount === 1 ? 'slide' : 'slides'}` : null].filter(Boolean).join(' · ')}</p>}
            {summary.banner && <p data-studio-deck-import-banner="true">{summary.banner}</p>}
            {(summary.lines.length > 0 || summary.notesLine) && <ul data-studio-deck-import-changes="true" aria-label="What changed">
              {summary.lines.map((line, index) => <li key={index}>{line.text}</li>)}
              {summary.notesLine && <li>{summary.notesLine}</li>}
            </ul>}
            {(summary.banner || summary.notesLine) && <Button data-studio-deck-import-action="open" onClick={imp.openDeck}>Open deck</Button>}
          </div>}
          {phase === 'failed' && failure && <div data-studio-deck-import-failed="true">
            <p data-studio-deck-import-error="true" role="alert">{LAUNCH_WORDING && failure.message === 'Import the PowerPoint this PDF came from. PDF import is coming.' ? 'Only PowerPoint (.pptx) files can be imported. If you have a PDF, import the PowerPoint it came from.' : failure.message}</p>
            <div data-studio-deck-import-actions="true">
              {failure.retryable && <Button data-studio-deck-import-action="retry" disabled={!imp.canStart} onClick={() => { void imp.begin() }}>Try again</Button>}
              <Button data-studio-deck-import-action="another" variant="outline" onClick={imp.reset}>Choose another file</Button>
            </div>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
