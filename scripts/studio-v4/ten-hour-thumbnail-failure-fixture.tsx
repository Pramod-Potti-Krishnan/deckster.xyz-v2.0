'use client'

// Honest local props: real strip/Viewer components, no build/refine command or acknowledgement.
import { useEffect, useState } from 'react'
import { PresentationViewer } from '@/components/presentation-viewer'
import { SlideThumbnailStrip, type SlideComposeThumbnailJob } from '@/components/slide-thumbnail-strip'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

const SLIDES = [
  { slideNumber:1, slideId:'studio-local-slide-one', title:'Supplied first slide' },
  { slideNumber:2, slideId:'studio-local-slide-two', title:'Supplied refinement target' },
]
const BUILD_REASON = 'Supplied native build diagnostic.\nThe complete reported text remains available for inspection.\n' + 'A long supplied diagnostic line with retained detail and identifier native_build_detail_0123456789. '.repeat(24)
const REFINE_REASON = 'Supplied native refinement diagnostic.\nThe complete reported text remains available for inspection.\n' + 'A long supplied diagnostic line with retained detail and identifier native_refine_detail_0123456789. '.repeat(24)
const JOBS: SlideComposeThumbnailJob[] = [
  { jobId:'studio-local-compose-failure', targetIndex:1, kind:'compose', status:'error', title:'Supplied build failure', errors:[BUILD_REASON,'Second supplied build reason.'] },
  { jobId:'studio-local-refine-failure', targetIndex:1, targetLayoutIndex:1, targetSlideId:'studio-local-slide-two', kind:'refine', status:'error', errors:[REFINE_REASON,'Second supplied refinement reason.'] },
]

export default function LocalThumbnailFailureFixture() {
  const [clientMounted, setClientMounted] = useState(false)
  const [draft, setDraft] = useState('Local unsent draft stays here while both supplied diagnostics are inspected.')
  const [selected, setSelected] = useState<number[]>([0])
  const [refused, setRefused] = useState(false)
  useEffect(() => { setClientMounted(true) }, [])
  return (
    <div data-studio-v4-shell="true" data-studio-thumbnail-failure-specimen="true" style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--ss-surface)', color:'var(--ss-text)' }}>
      <header style={{ padding:'10px 16px', fontSize:12, lineHeight:1.5, flexShrink:0, borderBottom:'1px solid var(--ss-line)' }}>
        <p style={{ margin:'0 0 6px' }}>Native thumbnail failure inspection · synthetic local error props, not generated failures. Both diagnostic kinds are supplied at once. Retry/refine actions are unavailable. The native read-only viewer mounts after hydration; no build/refine acknowledgement or service action is supplied.</p>
        <label>Local unsent draft <textarea data-studio-thumbnail-failure-specimen-draft="true" value={draft} onChange={event => setDraft(event.target.value)} rows={2} style={{ display:'block', width:'100%', resize:'none', color:'var(--ss-text)', background:'var(--ss-panel)', border:'1px solid var(--ss-line)', borderRadius:6, padding:6 }} /></label>
        <p data-studio-thumbnail-failure-specimen-selection="true" style={{ margin:'6px 0 0' }}>Local selected source indices: {selected.join(', ') || 'none'}</p>
        {refused && <p role="status" data-studio-thumbnail-failure-specimen-refused="true" style={{ margin:'6px 0 0' }}>Slide navigation refused locally. The supplied read-only viewer is unchanged.</p>}
      </header>
      <main style={{ flex:1, minHeight:0, minWidth:0, display:'flex', overflow:'hidden' }}>
        {clientMounted ? <PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer" presentationId="studio-v4-local-renderer" slideCount={2} showControls={false} isGenerating={false} className="h-full min-h-0 flex-1" /> : <p role="status">Preparing the local native viewer specimen…</p>}
        <aside data-studio-thumbnail-failure-specimen-strip="true" aria-label="Supplied native failure cards" style={{ width:152, flexShrink:0, minHeight:0, overflow:'hidden' }}>
          <SlideThumbnailStrip slides={SLIDES} currentSlide={1} onSlideClick={() => setRefused(true)} selectedSlides={selected} onSelectionChange={setSelected} composeJobs={JOBS} orientation="vertical" totalSlides={2} />
        </aside>
      </main>
    </div>
  )
}
