'use client'

// Actual native leaf with explicitly supplied state. No build or transport acknowledgement.
import { useState } from 'react'
import { DirectorPresence } from '@/components/build-narration/director-presence'
import { PresentationViewer } from '@/components/presentation-viewer'
import { initialNarrationState } from '@/lib/build-narration-heuristics'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export default function LocalDirectorPresenceFixture() {
  const [state,setState]=useState('thinking')
  const [draft,setDraft]=useState('Local unsent draft')
  const narration={...initialNarrationState(),active:state!=='hidden'&&state!=='thinking',phase:'paused' as const,phaseLabel:('Supplied native Director phase: preserve this complete returned status. ').repeat(12)+'Status ending retained.',deckEvents:Array.from({length:31},(_,i)=>({id:'local-'+i,scope:'deck' as const,stage:'planning',status:'progress' as const,text:'Returned local event '+i+': '+('Complete supplied planning context. ').repeat(6)+'Event ending retained.',seq:i,ts:0}))}
  return <div data-studio-v4-shell="true" data-studio-director-presence-specimen="true" style={{height:'100dvh',display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--ss-surface)',color:'var(--ss-text)'}}>
    <header style={{padding:12,flexShrink:0,fontSize:12}}>
      <p>Native DirectorPresence leaf · supplied status/events only. No conversation, build or service acknowledgement.</p>
      <label>Supplied presence state <select data-studio-director-presence-specimen-state="true" value={state} onChange={e=>setState(e.target.value)}><option value="thinking">Thinking status</option><option value="paused">Paused narration</option><option value="hidden">Inactive</option></select></label>
      <label style={{display:'block'}}>Local unsent draft <input data-studio-director-presence-specimen-draft="true" value={draft} onChange={e=>setDraft(e.target.value)} style={{width:'100%',background:'var(--ss-panel)',border:'1px solid var(--ss-line)',padding:6}} /></label>
    </header>
    <aside style={{width:'min(320px,100%)',margin:'0 auto',flexShrink:0}}><DirectorPresence narration={narration} currentStatus={state==='thinking'?{status:'thinking',text:('Supplied current Director thinking status remains complete and readable. ').repeat(12)+'Status ending retained.'}:null} /></aside>
    <main style={{flex:1,minHeight:0,display:'flex'}}><PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer" presentationId="studio-v4-local-renderer" slideCount={2} showControls={false} isGenerating={false} className="h-full min-h-0 flex-1" /></main>
  </div>
}
