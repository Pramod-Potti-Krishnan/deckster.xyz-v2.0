'use client'

// Supplied native leaf only, not an uncaught page error or a real reconnect/recovery attempt.
import { useState } from 'react'
import { WebSocketErrorFallback } from '@/components/websocket-error-fallback'

const LONG_REASON = 'Supplied native userMessage diagnostic.\nSecond supplied line stays intact.\n' + 'Long supplied connection detail and retained identifier local_diagnostic_0123456789. '.repeat(36)
export default function LocalWebSocketErrorFixture() {
  const [selected, setSelected] = useState('default')
  const [refused, setRefused] = useState(false)
  const errorDetails = selected === 'default' ? undefined : { userMessage:selected === 'long' ? LONG_REASON : 'A supplied connection diagnostic for native fallback inspection.' }
  return (
    <div data-studio-websocket-error-specimen="true" style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <header style={{ flexShrink:0, padding:'10px 16px', fontSize:12, lineHeight:1.5 }}>
        <p style={{ margin:'0 0 6px' }}>Native WebSocketErrorFallback leaf · synthetic supplied props. No uncaught page error, error classification, reconnect or recovery is produced. Reconnect reports only a local refusal in this specimen.</p>
        <label>Supplied native message <select data-studio-websocket-error-specimen-selector="true" value={selected} onChange={event => { setSelected(event.target.value); setRefused(false) }}>
          <option value="default">Exact native default</option><option value="short">Supplied short userMessage</option><option value="long">Supplied multiline long userMessage</option>
        </select></label>
        {refused && <p role="status" data-studio-websocket-error-specimen-refused="true">Reconnect refused locally. No boundary reset or request occurred.</p>}
      </header>
      <main style={{ flex:1, minHeight:0, minWidth:0, overflow:'hidden', display:'flex', alignItems:'center' }}>
        <WebSocketErrorFallback errorDetails={errorDetails} retry={() => setRefused(true)} />
      </main>
    </div>
  )
}
