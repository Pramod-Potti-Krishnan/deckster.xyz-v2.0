'use client'

// Supplied leaf states only; never sends or fabricates a save command/acknowledgement.
import { useEffect, useState } from 'react'
import { PresentationViewer } from '@/components/presentation-viewer'
import { StudioToolbarSaveFeedback } from '@/components/studio-toolbar-save-feedback'
import type { SaveStatus } from '@/components/save-status-indicator'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export default function LocalToolbarSaveFixture() {
  const [clientMounted, setClientMounted] = useState(false)
  useEffect(() => { setClientMounted(true) }, [])
  const [status, setStatus] = useState<SaveStatus>('unsaved')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(true)
  const [refused, setRefused] = useState(false)
  const [draft, setDraft] = useState('Local unsent draft; save status selections never save or reset it.')
  return (
    <div data-studio-v4-shell="true" data-studio-save-specimen="true" style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--ss-surface)', color:'var(--ss-text)' }}>
      <header style={{ padding:'10px 16px', fontSize:12, lineHeight:1.5, flexShrink:0, borderBottom:'1px solid var(--ss-line)' }}>
        <p style={{ margin:'0 0 6px' }}>Native toolbar Save leaf · synthetic local props supplied in the existing delivery slot. The viewer mounts after hydration so its native iframe load listener can observe loading. These states do not prove actual save, retry, autosave or persistence. The actual viewer remains outside editing and generation.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          <label>Supplied save status <select data-studio-save-specimen-status="true" value={status} onChange={event => { setStatus(event.target.value as SaveStatus); setRefused(false) }} style={{ background:'var(--ss-panel)', color:'var(--ss-text)' }}>
            <option value="unsaved">Unsaved</option><option value="error">Error</option><option value="saving">Saving</option><option value="saved">Saved (control hidden)</option>
          </select></label>
          <label><input data-studio-save-specimen-busy="true" type="checkbox" checked={busy} onChange={event => setBusy(event.target.checked)} /> Supplied save-in-progress override</label>
          <label><input data-studio-save-specimen-ready="true" type="checkbox" checked={ready} onChange={event => setReady(event.target.checked)} /> Supplied leaf readiness</label>
        </div>
        <label style={{ display:'block', marginTop:6 }}>Local unsent draft <textarea data-studio-save-specimen-draft="true" value={draft} onChange={event => setDraft(event.target.value)} rows={2} style={{ display:'block', width:'100%', resize:'none', color:'var(--ss-text)', background:'var(--ss-panel)', border:'1px solid var(--ss-line)', borderRadius:6, padding:6 }} /></label>
        {refused && <p role="status" data-studio-save-specimen-refused="true" style={{ margin:'6px 0 0' }}>Attempt refused locally. No save command or acknowledgement was supplied.</p>}
      </header>
      <main style={{ flex:1, minHeight:0, minWidth:0, display:'flex', overflow:'hidden' }}>
        {clientMounted ? <PresentationViewer
          presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
          presentationId="studio-v4-local-renderer"
          slideCount={2}
          showControls={true}
          isGenerating={false}
          className="h-full min-h-0 flex-1"
          downloadControls={<StudioToolbarSaveFeedback saveStatus={status} isSaving={busy} viewerIsReady={ready} onSave={() => setRefused(true)} toolbarButtonClass="flex h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40" toolbarLabelClass="text-[10px] font-medium" />}
        /> : <p role="status" data-studio-save-specimen-mounting="true">Preparing the local native viewer specimen…</p>}
      </main>
    </div>
  )
}
