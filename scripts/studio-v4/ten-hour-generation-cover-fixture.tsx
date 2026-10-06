'use client'

// Supplied local isGenerating only: no generation request, acknowledgement or result is produced.
import { useEffect, useState } from 'react'
import { PresentationViewer } from '@/components/presentation-viewer'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export default function LocalGenerationCoverFixture() {
  const [clientMounted, setClientMounted] = useState(false)
  const [showCover, setShowCover] = useState(false)
  const [draft, setDraft] = useState('Local unsent draft stays here while the supplied native cover is inspected.')
  useEffect(() => { setClientMounted(true) }, [])
  return (
    <div data-studio-v4-shell="true" data-studio-generation-specimen="true" data-studio-generation-specimen-cover={showCover ? 'true' : 'false'} style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--ss-surface)', color:'var(--ss-text)' }}>
      <header style={{ padding:'10px 16px', fontSize:12, lineHeight:1.5, flexShrink:0, borderBottom:'1px solid var(--ss-line)' }}>
        <p style={{ margin:'0 0 6px' }}>Native generation-cover component · synthetic local isGenerating prop. The checkbox supplies presentation state only; no generation starts, completes or acknowledges a result. The native loader and its decorative animation are unchanged. The read-only viewer mounts after hydration.</p>
        <label><input data-studio-generation-specimen-toggle="true" type="checkbox" checked={showCover} onChange={event => setShowCover(event.target.checked)} /> Show supplied generation cover</label>
        <label style={{ display:'block', marginTop:6 }}>Local unsent draft <textarea data-studio-generation-specimen-draft="true" value={draft} onChange={event => setDraft(event.target.value)} rows={2} style={{ display:'block', width:'100%', resize:'none', color:'var(--ss-text)', background:'var(--ss-panel)', border:'1px solid var(--ss-line)', borderRadius:6, padding:6 }} /></label>
      </header>
      <main style={{ flex:1, minHeight:0, minWidth:0, display:'flex', overflow:'hidden' }}>
        {clientMounted ? <PresentationViewer
          presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
          presentationId="studio-v4-local-renderer"
          slideCount={2}
          showControls={true}
          isGenerating={showCover}
          className="h-full min-h-0 flex-1"
        /> : <p role="status">Preparing the local native viewer specimen…</p>}
      </main>
    </div>
  )
}
