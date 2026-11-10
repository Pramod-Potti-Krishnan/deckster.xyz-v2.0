'use client'

// Explicit local leaf props only. Edit entry's real mutation acknowledgement is never simulated.
import { useState } from 'react'
import { EditModeGuide } from '@/components/edit-mode-guide'
import { PresentationViewer } from '@/components/presentation-viewer'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export default function LocalEditModeGuideFixture() {
  const [draft, setDraft] = useState('Local unsent draft stays here while the native guide is inspected.')
  return (
    <div data-studio-v4-shell="true" data-studio-edit-guide-specimen="true" style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--ss-surface)', color:'var(--ss-text)' }}>
      <header style={{ padding:'10px 16px', fontSize:12, lineHeight:1.5, flexShrink:0, borderBottom:'1px solid var(--ss-line)' }}>
        <p style={{ margin:'0 0 6px' }}>Native EditModeGuide leaf · synthetic local footer props. Native Edit entry requires a mutation acknowledgement, which this specimen never supplies. The supplied viewer stays outside edit mode and generation.</p>
        <label style={{ display:'block' }}>
          Local unsent draft
          <textarea data-studio-edit-guide-specimen-draft="true" value={draft} onChange={event => setDraft(event.target.value)} rows={2} style={{ display:'block', width:'100%', resize:'none', fontSize:12, color:'var(--ss-text)', background:'var(--ss-panel)', border:'1px solid var(--ss-line)', borderRadius:6, padding:6 }} />
        </label>
      </header>
      <main style={{ flex:1, minHeight:0, minWidth:0, display:'flex', overflow:'hidden' }}>
        <PresentationViewer
          presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer"
          presentationId="studio-v4-local-renderer"
          slideCount={2}
          showControls={false}
          isGenerating={false}
          className="h-full min-h-0 flex-1"
          stageChrome={{ footer: <div data-studio-edit-guide-specimen-boundary="true" style={{ height:88, position:'relative' }}><EditModeGuide /></div> }}
        />
      </main>
    </div>
  )
}
