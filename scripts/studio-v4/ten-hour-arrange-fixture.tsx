'use client'

// Supplied props only. Root installs the strict read-only native viewer adapter.
import { useState } from 'react'
import { ElementFormatPanel, type ElementFormatPanelProps } from '@/components/element-format-panel'
import { PresentationViewer } from '@/components/presentation-viewer'
import type { HeroElementProperties } from '@/types/elements'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'

export const ARRANGE_FIXTURE_DRAFT = 'Retained local Director draft while inspecting native Hero Arrange controls.'
export const ARRANGE_FIXTURE_PROPERTIES: HeroElementProperties = {
  elementId: 'synthetic-local-hero-props', type: 'hero', heroType: 'title',
  position: { x: 11, y: 22 }, size: { width: 400, height: 200 }, rotation: 40,
  locked: false, zIndex: 3, flipped: { horizontal: false, vertical: true },
  cssClasses: ['synthetic-native-hero', 'synthetic-preserved-class'],
  title: 'Synthetic Hero supplied for native control inspection',
  subtitle: 'Local props only; no iframe selection or edit is acknowledged.',
}

export default function LocalArrangeFixture() {
  const [draft, setDraft] = useState(ARRANGE_FIXTURE_DRAFT)
  const [locked, setLocked] = useState(false)
  const [counts, setCounts] = useState({ commands: 0, delete: 0, close: 0 })
  const record = (name: keyof typeof counts) => setCounts(previous => ({ ...previous, [name]: previous[name] + 1 }))
  const panelProps: ElementFormatPanelProps = {
    isOpen: true, elementId: ARRANGE_FIXTURE_PROPERTIES.elementId, elementType: 'hero',
    properties: { ...ARRANGE_FIXTURE_PROPERTIES, locked },
    presentationId: 'studio-v4-local-renderer', slideIndex: 0,
    onClose: () => record('close'),
    onSendCommand: async () => {
      record('commands')
      throw new Error('Local Arrange specimen refuses every command. No edit or service success is acknowledged.')
    },
    onDelete: async () => {
      record('delete')
      throw new Error('Local Arrange specimen refuses deletion. No service success is acknowledged.')
    },
  }
  return <div data-studio-v4-shell="true" data-studio-arrange-fixture="true">
    <style>{`
      [data-studio-arrange-fixture] { height:100dvh; min-height:0; overflow:hidden; padding:12px; display:flex; flex-direction:column; gap:10px; }
      [data-studio-arrange-fixture] > header { flex-shrink:0; font-size:11px; line-height:17px; }
      [data-studio-arrange-fixture] > header strong { display:block; font-size:13px; }
      [data-studio-arrange-fixture] [data-local-controls] { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; margin-block:8px; }
      [data-studio-arrange-fixture] [data-local-callback-counters] { overflow-wrap:anywhere; color:var(--ss-muted); }
      [data-studio-arrange-fixture] [data-local-draft] { display:flex; align-items:center; gap:10px; }
      [data-studio-arrange-fixture] [data-local-draft] textarea { flex:1; min-width:0; height:44px; padding:7px 10px; border:1px solid var(--ss-line); border-radius:7px; background:var(--ss-panel); color:var(--ss-text); }
      [data-studio-arrange-fixture] > main { flex:1; min-width:0; min-height:0; display:grid; grid-template-columns:360px minmax(0,1fr); gap:12px; }
      [data-studio-arrange-fixture] [data-local-arrange-panel] { position:relative; min-width:0; min-height:0; overflow:hidden; border:1px solid var(--ss-line); border-radius:10px; }
      [data-studio-arrange-fixture] [data-local-viewer] { min-width:0; min-height:0; overflow:hidden; border:1px solid var(--ss-line); border-radius:10px; }
      [data-studio-arrange-fixture] [data-local-draft] textarea:focus-visible { outline:2px solid var(--ss-accent); outline-offset:2px; }
      @media(max-width:720px) { [data-studio-arrange-fixture] { height:auto; min-height:100dvh; overflow:visible; } [data-studio-arrange-fixture] > main { grid-template-columns:minmax(0,1fr); } [data-studio-arrange-fixture] [data-local-arrange-panel] { height:520px; } [data-studio-arrange-fixture] [data-local-viewer] { height:330px; } [data-studio-arrange-fixture] [data-local-draft] { flex-direction:column; align-items:stretch; } }
    `}</style>
    <header>
      <strong>Actual Hero Format → Arrange · supplied synthetic props</strong>
      Native selection enters edit mode and sends an ordering command; that entry is not exercised here. Every panel command/delete is refused, with no ACK or service operation. Inspect focus and supplied states without activating operation buttons. Field typing is native local state; blur may attempt a refused command. Root supplies the read-only viewer adapter.
      <div data-local-controls="true">
        <label><input id="local-arrange-locked" type="checkbox" checked={locked} onChange={event => setLocked(event.target.checked)} /> Supplied locked state · local specimen only</label>
        <output data-local-callback-counters="true" aria-label="Local refused Arrange callback counts">Commands refused {counts.commands} · Delete refused {counts.delete} · Close callbacks {counts.close}</output>
      </div>
      <label data-local-draft="true">Retained local draft<textarea id="local-arrange-draft" value={draft} onChange={event => setDraft(event.target.value)} /></label>
    </header>
    <main>
      <section data-local-arrange-panel="true" aria-label="Actual Hero Format panel with synthetic props"><ElementFormatPanel {...panelProps} /></section>
      <section data-local-viewer="true" aria-label="Native presentation viewer with read-only adapter"><PresentationViewer presentationUrl="https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer" presentationId="studio-v4-local-renderer" slideCount={6} showControls={false} isGenerating={false} className="h-full min-h-0" /></section>
    </main>
  </div>
}
