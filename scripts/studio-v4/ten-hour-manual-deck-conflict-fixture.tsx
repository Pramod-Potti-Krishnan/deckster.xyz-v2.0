'use client'

// Synthetic props only. Root supplies the strict read-only native viewer adapter.
import { useState } from 'react'
import { ManualDeckConflictDialog } from '@/components/builder/manual-deck-conflict-dialog'
import { PresentationViewer } from '@/components/presentation-viewer'
import type { ManualDeckSummary } from '@/lib/manual-deck-workflow'
import '@/app/builder/studio-v4.css'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export const MANUAL_CONFLICT_FIXTURE_DRAFT = 'Retained local Director draft while reviewing the customized-slides choice.'
export const MANUAL_CONFLICT_FIXTURE_SUMMARY: ManualDeckSummary = {
  slide_count: 3, element_count: 7, customized_slide_count: 3, note_count: 0,
  slide_titles: ['Synthetic first slide', 'Synthetic second slide', 'Synthetic third slide'],
  slides: [], reasons: ['elements'],
}
export const MANUAL_CONFLICT_FIXTURE_ERROR = [
  'Synthetic local error props. No build, handoff, session creation or save was attempted.',
  ...Array.from({ length: 8 }, (_, index) => `Local explanation ${index + 1}: The complete native error should remain readable while scrolling and using the keyboard. This supplied text does not describe an actual service response or acknowledge any persistence. The author’s draft and supplied customized-slide counts remain unchanged.`),
  'End of the complete synthetic explanation.',
].join('\n\n')

export default function LocalManualDeckConflictFixture() {
  const [draft, setDraft] = useState(MANUAL_CONFLICT_FIXTURE_DRAFT)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showError, setShowError] = useState(false)
  const [counts, setCounts] = useState({ cancel: 0, prepend: 0, newSession: 0 })
  const record = (name: keyof typeof counts) => setCounts(previous => ({ ...previous, [name]: previous[name] + 1 }))
  return <div data-studio-v4-shell="true" data-studio-manual-conflict-fixture="true">
    <style>{`
      [data-studio-manual-conflict-fixture] { height:100dvh; overflow:hidden; padding:16px; display:grid; grid-template-rows:auto minmax(0,1fr); gap:16px; color:var(--ss-text); background:var(--ss-frame); }
      [data-studio-manual-conflict-fixture] header { font-size:12px; line-height:1.7; }
      [data-studio-manual-conflict-fixture] header strong { display:block; font-size:15px; }
      [data-studio-manual-conflict-fixture] [data-local-controls] { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:12px 0; }
      [data-studio-manual-conflict-fixture] button { padding:8px 12px; border:1px solid var(--ss-line); border-radius:7px; background:var(--ss-panel); }
      [data-studio-manual-conflict-fixture] textarea { display:block; width:100%; min-height:60px; padding:10px; border:1px solid var(--ss-line); border-radius:8px; background:var(--ss-panel); }
      [data-studio-manual-conflict-fixture] [data-local-viewer] { min-height:0; min-width:0; overflow:hidden; border:1px solid var(--ss-line); border-radius:12px; }
      [data-studio-manual-conflict-fixture] button:focus-visible, [data-studio-manual-conflict-fixture] textarea:focus-visible { outline:2px solid var(--ss-accent); outline-offset:3px; }
    `}</style>
    <header>
      <strong>Native customized-slides dialog · synthetic props</strong>
      No build, save, handoff or session creation runs here. Choices increment local counters only; they do not acknowledge success or close the dialog. Cancel uses the native close path. Root supplies the read-only viewer adapter.
      <div data-local-controls="true">
        <button type="button" data-local-conflict-opener="true" onClick={() => setOpen(true)}>Open customized-slides choice</button>
        <label><input type="checkbox" checked={busy} onChange={event => setBusy(event.target.checked)} /> Supplied busy state</label>
        <label><input type="checkbox" checked={showError} onChange={event => setShowError(event.target.checked)} /> Supplied complete error</label>
        <output aria-label="Local conflict callback counters">Cancel {counts.cancel} · Prepend {counts.prepend} · New session {counts.newSession}</output>
      </div>
      <label>Retained local draft<textarea value={draft} onChange={event => setDraft(event.target.value)} /></label>
    </header>
    <section data-local-viewer="true" aria-label="Native presentation viewer with read-only adapter">
      <PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer" presentationId="studio-v4-local-renderer" slideCount={6} showControls={false} isGenerating={false} className="h-full min-h-0" />
    </section>
    <ManualDeckConflictDialog open={open} summary={MANUAL_CONFLICT_FIXTURE_SUMMARY} busy={busy} error={showError ? MANUAL_CONFLICT_FIXTURE_ERROR : null} onCancel={() => { record('cancel'); setOpen(false) }} onPrependGenerated={() => record('prepend')} onStartNewSession={() => record('newSession')} />
  </div>
}
