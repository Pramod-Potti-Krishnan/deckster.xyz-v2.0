'use client'

// Exact native copy in clearly supplied component scopes; no auth/session lifecycle is modeled.
import { useState } from 'react'
import { StudioWaitingState } from '@/components/builder/studio-waiting-state'

const CASES = [
  { value:'builder', label:'Builder/auth loading', scope:'screen', message:'Loading builder...' },
  { value:'session', label:'Canvas session loading', scope:'canvas', message:'Loading session...' },
  { value:'account', label:'Account switch (native default copy)', scope:'screen', message:'Loading builder...' },
  { value:'redirect', label:'Sign-in redirect', scope:'screen', message:'Redirecting to sign in...' },
] as const

export default function LocalWaitingFixture() {
  const [selected, setSelected] = useState<string>('builder')
  const current = CASES.find(item => item.value === selected) ?? CASES[0]
  return (
    <div data-studio-waiting-specimen="true" data-studio-waiting-specimen-case={current.value} style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'#f5f7f6', color:'#425b4f' }}>
      <style>{`
        .dark [data-studio-waiting-specimen="true"] { background:#222d30 !important; color:#b4c5bd !important; }
        [data-studio-waiting-specimen="true"] [data-studio-v4-shell="true"][data-studio-waiting="true"][data-waiting-scope="screen"] { min-height:0; height:100%; }
      `}</style>
      <header style={{ flexShrink:0, padding:'10px 16px', fontSize:12, lineHeight:1.5 }}>
        <p style={{ margin:'0 0 6px' }}>Native waiting leaf · synthetic supplied props. No auth, account switch, session load or redirect is started or settled. The screen scope is bounded to the remaining specimen area; the product uses the viewport.</p>
        <label>Supplied waiting view <select data-studio-waiting-specimen-selector="true" value={selected} onChange={event => setSelected(event.target.value)} style={{ maxWidth:'100%', background:'transparent', color:'inherit', border:'1px solid currentColor', borderRadius:6, padding:'4px 6px' }}>
          {CASES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select></label>
        {current.value === 'account' && <p style={{ margin:'6px 0 0' }}>The actual accountChanged caller uses the default Loading builder... message.</p>}
      </header>
      <main data-studio-waiting-specimen-view="true" style={{ flex:1, minHeight:0, minWidth:0, display:'flex', overflow:'hidden' }}>
        <StudioWaitingState scope={current.scope} message={current.message} />
      </main>
    </div>
  )
}
